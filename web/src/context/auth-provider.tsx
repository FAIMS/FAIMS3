import {useEffect, createContext, useState, useContext} from 'react';

export interface User {
  user: {
    id: string;
    name: string;
    email: string;
    cluster_admin: boolean;
  };
  token: string;
  refreshToken: string;
}

export interface AuthContext {
  isAuthenticated: boolean;
  getUserDetails: (
    token?: string,
    refreshToken?: string
  ) => Promise<{
    status: string;
    message: string;
  }>;
  logout: () => void;
  user: User | null;
}

const AuthContext = createContext<AuthContext | null>(null);

const key = 'user';

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
  const [user, setUser] = useState<User | null>(
    JSON.parse(localStorage.getItem(key) || 'null')
  );

  const isAuthenticated = !!user;

  /**
   * Logs out the user by removing the stored user object and setting the user to null.
   */
  const logout = () => {
    window.location.href = `${
      import.meta.env.VITE_API_URL
    }/logout?redirect=${import.meta.env.VITE_WEB_URL}`;

    setStoredUser(null);
    setUser(null);
  };

  /**
   * Fetches the user details from the API and stores them in the user object.
   * @param {string} token - The token to use for authentication.
   * @param {string} refreshToken - The refresh token to use for authentication.
   * @returns {Promise<{status: string, message: string}>} A promise that resolves to an object containing the status and message.
   */
  const getUserDetails = async (token?: string, refreshToken = '') => {
    if (!token) return {status: 'error', message: 'No token provided'};

    const response = await fetch(
      `${import.meta.env.VITE_API_URL}/api/users/current`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) return {status: 'error', message: 'Error fetching user'};

    const user = await response.json();

    setStoredUser({user, token, refreshToken});
    setUser({user, token, refreshToken});

    return {status: 'success', message: ''};
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

    setStoredUser({...user, token});
    setUser({...user, token});

    return {status: 'success', message: ''};
  };

  useEffect(() => {
    if (isAuthenticated) {
      refreshToken();

      const intervalId = setInterval(refreshToken, 5 * 60 * 1000);
      return () => clearInterval(intervalId);
    }
  }, [isAuthenticated]);

  return (
    <AuthContext.Provider
      value={{isAuthenticated, user, getUserDetails, logout}}
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
