import { useCallback, useEffect, useMemo, useState } from 'react';
import { AuthContext, initialUser } from './authContextDef.js';
import { login as loginRequest, logout as logoutRequest, restoreSession } from '../api/authApi.js';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(initialUser);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    let active = true;
    restoreSession()
      .then((restored) => {
        if (!active) return;
        if (restored) {
          setUser(restored);
          setStatus('authenticated');
        } else {
          setStatus('unauthenticated');
        }
      })
      .catch(() => {
        if (active) setStatus('unauthenticated');
      });
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (credentials) => {
    const loggedIn = await loginRequest(credentials);
    setUser(loggedIn);
    setStatus('authenticated');
    return loggedIn;
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } finally {
      setUser(initialUser);
      setStatus('unauthenticated');
    }
  }, []);

  const value = useMemo(
    () => ({ user, status, login, logout }),
    [user, status, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}