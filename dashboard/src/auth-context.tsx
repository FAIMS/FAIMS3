import {
  decodeAndValidateToken,
  TokenContents,
  TokenPayload,
} from '@faims3/data-model';
import {jwtDecode} from 'jwt-decode';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  API_URL,
  DASHBOARD_URL,
  TOKEN_CHECK_INTERVAL_MS,
  TOKEN_REFRESH_BUFFER_MS,
} from './constants';

export interface User {
  token: string;
  refreshToken: string;
  decodedToken: TokenContents | null;
}

export interface AuthContextValue {
  isAuthenticated: boolean;
  isExpired: () => boolean;
  user: User | null;
  login: () => void;
  logout: () => Promise<void>;
  refreshToken: () => Promise<{status: 'success' | 'error'; message: string}>;
  handleExchangeTokenReturn: () => Promise<void>;
}

const STORAGE_KEY = 'dashboard_user';

const AuthContext = createContext<AuthContextValue | null>(null);

function decodeToken(token: string): TokenContents | null {
  try {
    const payload = jwtDecode<TokenPayload & {exp: number}>(token);
    if (payload.exp * 1000 < Date.now() - 60 * 1000) {
      console.error('Access token has expired.');
      return null;
    }
    return {...payload, ...decodeAndValidateToken(payload)};
  } catch (e) {
    console.error('Failed to decode token:', e);
    return null;
  }
}

function setStoredUser(user: User | null) {
  if (user) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function getStoredUser(): User | null {
  const storedUser = localStorage.getItem(STORAGE_KEY);
  if (!storedUser) return null;

  try {
    const parsed = JSON.parse(storedUser) as User;
    if (parsed && parsed.token) {
      parsed.decodedToken = decodeToken(parsed.token);
    }
    return parsed;
  } catch (e) {
    console.error('Failed to parse stored dashboard user:', e);
    return null;
  }
}

export function isUserExpired(user: User | null) {
  if (!user || !user.decodedToken || !user.token) return true;
  return user.decodedToken.exp * 1000 < Date.now();
}

export function AuthProvider({children}: {children: React.ReactNode}) {
  const [user, setUser] = useState<User | null>(() => getStoredUser());
  const userRef = useRef<User | null>(user);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const isExpired = useCallback(() => isUserExpired(user), [user]);

  const isAuthenticated = !!user && !isExpired();

  const refreshToken = useCallback(async () => {
    const currentUser = userRef.current;
    if (!currentUser)
      return {status: 'error' as const, message: 'No user to refresh'};

    const response = await fetch(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${currentUser.token}`,
      },
      body: JSON.stringify({refreshToken: currentUser.refreshToken}),
    });

    if (!response.ok) {
      setStoredUser(null);
      setUser(null);
      return {status: 'error' as const, message: 'Refresh token failed'};
    }

    const {token} = (await response.json()) as {token: string};
    const decodedToken = decodeToken(token);

    const updatedUser: User = {
      token,
      refreshToken: currentUser.refreshToken,
      decodedToken,
    };

    setStoredUser(updatedUser);
    setUser(updatedUser);

    return {status: 'success' as const, message: ''};
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const intervalId = setInterval(() => {
      const currentUser = userRef.current;
      if (!currentUser?.decodedToken) return;

      const expiresAtMs = currentUser.decodedToken.exp * 1000;
      const nowMs = Date.now();
      const msUntilExpiry = expiresAtMs - nowMs;

      if (msUntilExpiry < TOKEN_REFRESH_BUFFER_MS) {
        void refreshToken();
      }
    }, TOKEN_CHECK_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [isAuthenticated, refreshToken]);

  const login = useCallback(() => {
    window.location.href = `${API_URL}/login?redirect=${encodeURIComponent(DASHBOARD_URL)}`;
  }, []);

  const logout = useCallback(async () => {
    if (user) {
      try {
        await fetch(`${API_URL}/auth/logout`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${user.token}`,
          },
          body: JSON.stringify({
            refreshToken: user.refreshToken,
          }),
        });
      } catch (e) {
        console.error('Error during dashboard logout:', e);
      }
    }
    setStoredUser(null);
    setUser(null);
    window.location.href = DASHBOARD_URL;
  }, [user]);

  const handleExchangeTokenReturn = useCallback(async () => {
    const params = new URLSearchParams(window.location.search);
    const exchangeToken = params.get('exchangeToken');
    const serverId = params.get('serverId');

    if (!exchangeToken) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/auth/exchange`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({exchangeToken}),
      });

      if (!response.ok) {
        console.error('Failed login exchange in dashboard!');
        return;
      }

      const {accessToken, refreshToken} = (await response.json()) as {
        accessToken: string;
        refreshToken: string;
      };

      const decodedToken = decodeToken(accessToken);
      const newUser: User = {
        token: accessToken,
        refreshToken,
        decodedToken,
      };

      setStoredUser(newUser);
      setUser(newUser);

      // Clean URL – strip auth params but keep path
      const url = new URL(window.location.href);
      url.searchParams.delete('exchangeToken');
      if (serverId) url.searchParams.delete('serverId');
      window.history.replaceState(null, '', url.toString());
    } catch (e) {
      console.error('Unhandled error during token exchange in dashboard:', e);
    }
  }, []);

  useEffect(() => {
    // Run once on mount to handle potential auth return
    void handleExchangeTokenReturn();
  }, [handleExchangeTokenReturn]);

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated,
      isExpired,
      user,
      login,
      logout,
      refreshToken,
      handleExchangeTokenReturn,
    }),
    [isAuthenticated, isExpired, user, login, logout, refreshToken, handleExchangeTokenReturn]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}

