import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, getToken, setToken } from './api.js';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [member, setMember] = useState(null); // ficha de integrante de la planilla
  const [loading, setLoading] = useState(!!getToken());

  const applySession = useCallback((d) => {
    setUser(d.user);
    setMember(d.member);
  }, []);

  useEffect(() => {
    if (!getToken()) return;
    api('/auth/me')
      .then(applySession)
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, [applySession]);

  const value = {
    user,
    member,
    loading,
    login: async (email, password) => {
      const d = await api('/auth/login', { method: 'POST', body: { email, password } });
      setToken(d.token);
      applySession(d);
      return d.user;
    },
    logout: () => {
      setToken(null);
      setUser(null);
      setMember(null);
    },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
