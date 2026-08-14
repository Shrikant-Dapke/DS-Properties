import { createContext, useContext, useEffect, useState } from 'react';
import * as authApi from '../services/auth.service.js';

const AuthContext = createContext(null);
const TOKEN_KEY = 'ds_token';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    if (!token) {
      setLoading(false);
      return;
    }

    authApi
      .getMe()
      .then((res) => {
        if (active) setUser(res.data.data);
      })
      .catch(() => {
        if (!active) return;
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [token]);

  async function login(username, password) {
    const res = await authApi.login(username, password);
    const { token: t, admin } = res.data.data;
    localStorage.setItem(TOKEN_KEY, t);
    setToken(t);
    setUser(admin);
    return admin;
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
