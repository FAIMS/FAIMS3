import * as React from 'react';

export interface User {
  user: {
    id: string;
    name: string;
    email: string;
  };
  token: string;
}

export interface AuthContext {
  isAuthenticated: boolean;
  login: (
    username: string,
    password: string
  ) => Promise<{status: string; message: string}>;
  logout: () => Promise<void>;
  signup: (
    email: string,
    name: string,
    password: string
  ) => Promise<{status: string; message: string}>;
  user: User | null;
}

const AuthContext = React.createContext<AuthContext | null>(null);

const key = 'user';
function setStoredUser(user: User | null) {
  if (user) {
    localStorage.setItem(key, JSON.stringify(user));
  } else {
    localStorage.removeItem(key);
  }
}

export function AuthProvider({children}: {children: React.ReactNode}) {
  const [user, setUser] = React.useState<User | null>(
    JSON.parse(localStorage.getItem(key) || 'null')
  );
  const isAuthenticated = !!user;

  const logout = async () => {
    setStoredUser(null);
    setUser(null);
  };

  const login = async (username: string, password: string) => {
    const response = await fetch('http://localhost:8080/web/login/local', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username,
        password,
      }),
    });

    const {status, ok} = response;

    if (status === 401)
      return {status: 'error', message: 'Invalid username or password'};
    if (!ok) return {status: 'error', message: 'Unknown error'};

    const user = (await response.json()) as User;

    setStoredUser(user);
    setUser(user);

    return {status: 'success', message: ''};
  };

  const signup = async (email: string, name: string, password: string) => {
    const response = await fetch('http://localhost:8080/web/signup/local', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        name,
        password,
      }),
    });

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
      value={{isAuthenticated, user, login, signup, logout}}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
