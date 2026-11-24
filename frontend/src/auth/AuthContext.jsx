import { useCallback, useEffect, useMemo, useState } from 'react';
import { authApi } from '../api/auth.js';
import { AuthContext } from './auth-context.js';
const tokenStorageKey = 'rojgar-setu-access-token';

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() =>
    window.sessionStorage.getItem(tokenStorageKey),
  );
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState(() =>
    window.sessionStorage.getItem(tokenStorageKey)
      ? 'loading'
      : 'unauthenticated',
  );

  useEffect(() => {
    if (!token) {
      return undefined;
    }

    let active = true;
    authApi
      .currentUser(token)
      .then(({ user: currentUser }) => {
        if (active) {
          setUser(currentUser);
          setStatus('authenticated');
        }
      })
      .catch(() => {
        if (active) {
          window.sessionStorage.removeItem(tokenStorageKey);
          setToken(null);
          setUser(null);
          setStatus('unauthenticated');
        }
      });

    return () => {
      active = false;
    };
  }, [token]);

  const login = useCallback(async (credentials) => {
    const result = await authApi.login(credentials);
    window.sessionStorage.setItem(tokenStorageKey, result.accessToken);
    setToken(result.accessToken);
    setUser(result.user);
    setStatus('authenticated');
    return result.user;
  }, []);

  const logout = useCallback(async () => {
    if (token) {
      try {
        await authApi.logout(token);
      } catch (error) {
        if (error.response?.status !== 401) {
          throw error;
        }
      }
    }

    window.sessionStorage.removeItem(tokenStorageKey);
    setToken(null);
    setUser(null);
    setStatus('unauthenticated');
  }, [token]);

  const value = useMemo(
    () => ({ user, status, login, logout }),
    [user, status, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
