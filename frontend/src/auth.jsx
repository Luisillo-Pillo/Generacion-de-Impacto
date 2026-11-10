import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, getToken, sendOffline, setToken, SESSION_EXPIRED } from './api.js';
import { startPresence } from './presence.js';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [member, setMember] = useState(null); // ficha de integrante de la planilla
  const [loading, setLoading] = useState(!!getToken());
  const [expired, setExpired] = useState(false); // la sesión se perdió sola (vencida o cerrada desde otro dispositivo)

  const applySession = useCallback((d) => {
    setUser(d.user);
    setMember(d.member);
  }, []);

  useEffect(() => {
    const onExpired = () => {
      setUser(null);
      setMember(null);
      setExpired(true);
    };
    window.addEventListener(SESSION_EXPIRED, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED, onExpired);
  }, []);

  // Con una sesión iniciada, la pestaña avisa cada minuto que sigue conectada (ver presence.js)
  const signedIn = !!user;
  useEffect(() => (signedIn ? startPresence() : undefined), [signedIn]);

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
    expired,
    // Vuelve a pedir la sesión (p. ej. tras editar la propia información) para que el nombre y la foto se actualicen
    refresh: () => api('/auth/me').then(applySession),
    login: async (email, password) => {
      const d = await api('/auth/login', { method: 'POST', body: { email, password } });
      setToken(d.token);
      setExpired(false);
      applySession(d);
      return d.user;
    },
    logout: () => {
      sendOffline(); // se desconecta al instante, sin esperar a que venza el plazo (hay que mandarlo antes de borrar el token)
      setToken(null);
      setExpired(false);
      setUser(null);
      setMember(null);
    },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
