import * as React from 'react';

export interface User {
  user: {
    id: string;
    name: string;
    email: string;
  };
  token: string;
  refreshToken: string;
}

export interface AuthContext {
  isAuthenticated: boolean;
  login: (
    username: string,
    password: string
  ) => Promise<{status: string; message: string}>;
  loginWithToken: (
    token?: string,
    refreshToken?: string
  ) => Promise<{
    status: string;
    message: string;
  }>;
  logout: () => void;
  signup: (
    email: string,
    name: string,
    password: string
  ) => Promise<{status: string; message: string}>;
  user: User | null;
}

const AuthContext = React.createContext<AuthContext | null>(null);

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
  const [user, setUser] = React.useState<User | null>(
    JSON.parse(localStorage.getItem(key) || 'null')
  );

  const isAuthenticated = !!user;

  /**
   * Logs out the user by removing the stored user object and setting the user to null.
   */
  const logout = () => {
    setStoredUser(null);
    setUser(null);
  };

  const loginWithToken = async (token?: string, refreshToken = '') => {
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
   * Logs in a user using the provided username and password.
   * @param {string} username - The username of the user.
   * @param {string} password - The password of the user.
   * @returns {Promise<{status: string; message: string}>} The result of the login operation.
   */
  const login = async (username: string, password: string) => {
    const response = await fetch(
      `${import.meta.env.VITE_API_URL}/web/login/local`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          password,
        }),
      }
    );

    const {status, ok} = response;

    if (status === 401)
      return {status: 'error', message: 'Invalid username or password'};
    if (!ok) return {status: 'error', message: 'Unknown error'};

    const user = (await response.json()) as User;

    setStoredUser(user);
    setUser(user);

    return {status: 'success', message: ''};
  };

  /**
   * Signs up a new user with an email, name, and password.
   * @param {string} email - The email of the user.
   * @param {string} name - The name of the user.
   * @param {string} password - The password of the user.
   * @returns {Promise<{status: string; message: string}>} The result of the signup operation.
   */
  const signup = async (email: string, name: string, password: string) => {
    const response = await fetch(
      `${import.meta.env.VITE_API_URL}/web/signup/local`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          name,
          password,
        }),
      }
    );

    if (!response.ok)
      return {
        status: 'error',
        message: (await response.text()) || 'Error signing up',
      };

    const user = (await response.json()) as User;

    setStoredUser(user);
    setUser(user);

    return {status: 'success', message: ''};
  };

  return (
    <AuthContext.Provider
      value={{isAuthenticated, user, login, loginWithToken, signup, logout}}
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
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
