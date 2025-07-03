import {API_URL, REFRESH_INTERVAL, WEB_URL} from '@/constants';
import {getCurrentUser} from '@/hooks/queries';
import {
  decodeAndValidateToken,
  PutLogoutInput,
  TokenContents,
  TokenPayload,
} from '@faims3/data-model';
import {jwtDecode} from 'jwt-decode';
import {createContext, useContext, useEffect, useState} from 'react';

export interface User {
  user: {
    id: string;
    name: string;
    email: string;
    isVerified: boolean;
  };
  token: string;
  refreshToken: string;
  decodedToken: TokenContents | null;
}

export interface AuthContext {
  isAuthenticated: boolean;
  getUserDetails: (
    token?: string,
    refreshToken?: string
  ) => Promise<{
    status: 'success' | 'error';
    message: string;
  }>;
  logout: () => void;
  user: User | null;
  refreshToken: () => Promise<{status: string; message: string}>;
}

const AuthContext = createContext<AuthContext | null>(null);

const key = 'user';

/**
 * Decodes a JWT token string into TokenContents.
 * @param {string} token - The JWT token to decode.
 * @returns {TokenContents | null} The decoded token or null if decoding fails.
 */
function decodeToken(token: string): TokenContents | null {
  try {
    // TODO clarify the typing for payload vs contents -this is confusing!
    const payload = jwtDecode<TokenPayload & {exp: number}>(token);

    // Minute buffer is considered expired
    if (payload.exp * 1000 < Date.now() - 60 * 1000) {
      console.error('Access token has expired.');
      return null;
    }

    // Combine the permissions part with the base payload to construct a complete version
    return {...payload, ...decodeAndValidateToken(payload)};
  } catch (e) {
    console.error('Failed to decode token:', e);
    return null;
  }
}

/**
 * Stores or removes the user object in/from localStorage.
 * @param {User | null} user - The user object to store or `null` to remove the user.
 */
function setStoredUser(user: User | null) {
  if (user) {
    localStorage.setItem(key, JSON.stringify(user));
  } else {
    localStorage.removeItem(key);
  }
}

/**
 * Provides authentication context to its children.
 * @param {{children: React.ReactNode}} props - The children components that will receive the auth context.
 * @returns {JSX.Element} The AuthProvider component.
 */
export function AuthProvider({children}: {children: React.ReactNode}) {
  const [user, setUser] = useState<User | null>(() => {
    const storedUser = localStorage.getItem(key);
    if (!storedUser) return null;

    try {
      const parsedUser = JSON.parse(storedUser);
      // Add decoded token to stored user if it exists
      if (parsedUser && parsedUser.token) {
        parsedUser.decodedToken = decodeToken(parsedUser.token);
      }
      return parsedUser;
    } catch (e) {
      console.error('Failed to parse stored user:', e);
      return null;
    }
  });

  const isAuthenticated = !!user;

  useEffect(() => {
    if (isAuthenticated) {
      refreshToken();

      const intervalId = setInterval(refreshToken, REFRESH_INTERVAL);
      return () => clearInterval(intervalId);
    }
  }, [isAuthenticated]);

  /**
   * Logs out the user by removing the stored user object and setting the user to null.
   */
  const logout = async () => {
    if (user) {
      // Make a PUT to logout endpoint - we don't really care whether this
      // succeeds or fails - it's a client nicety to invalidate the refresh
      // token
      await fetch(`${API_URL}/auth/logout`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({
          refreshToken: user.refreshToken,
        } satisfies PutLogoutInput),
      });
      setStoredUser(null);
      setUser(null);
    }
    window.location.href = WEB_URL;
  };

  /**
   * Fetches the user details from the API and stores them in the user object.
   * @param {string} token - The token to use for authentication.
   * @param {string} refreshToken - The refresh token to use for authentication.
   * @returns {Promise<{status: string, message: string}>} A promise that resolves to an object containing the status and message.
   */
  const getUserDetails = async (
    token?: string,
    refreshToken = ''
  ): Promise<{status: 'error' | 'success'; message: string}> => {
    if (!token) return {status: 'error', message: 'No token provided'};

    try {
      const userData = await getCurrentUser({token});
      const decodedToken = decodeToken(token);

      const updatedUser = {
        user: userData,
        token,
        refreshToken,
        decodedToken,
      } satisfies User;

      setStoredUser(updatedUser);
      setUser(updatedUser);

      return {status: 'success', message: ''};
    } catch (e) {
      return {status: 'error', message: 'Error fetching user ' + e};
    }
  };

  /**
   * Refreshes the user's token by making a POST request to the API.
   * @returns {Promise<{status: string, message: string}>} A promise that resolves to an object containing the status and message.
   */
  const refreshToken = async () => {
    if (!user) return {status: 'error', message: 'No user to refresh'};

    const response = await fetch(
      `${import.meta.env.VITE_API_URL}/api/auth/refresh`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({refreshToken: user.refreshToken}),
      }
    );

    if (!response.ok) {
      setStoredUser(null);
      setUser(null);

      return {status: 'error', message: 'Refresh token failed'};
    }

    const {token} = await response.json();
    const decodedToken = decodeToken(token);
    let userData = user.user;

    try {
      userData = await getCurrentUser({token});
    } catch (e) {
      console.error('Failed to fetch updated user data!', e);
    }

    const updatedUser = {
      user: userData,
      token,
      refreshToken: user.refreshToken,
      decodedToken,
    } satisfies User;

    setStoredUser(updatedUser);
    setUser(updatedUser);

    return {status: 'success', message: ''};
  };

  return (
    <AuthContext.Provider
      value={{isAuthenticated, user, getUserDetails, logout, refreshToken}}
    >
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Custom hook to access the authentication context.
 * @returns {AuthContext} The current authentication context value.
 * @throws Will throw an error if used outside of an AuthProvider.
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
