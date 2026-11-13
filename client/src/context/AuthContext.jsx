import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, setSessionToken } from "../lib/api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | authenticated | anonymous
  const [authConfig, setAuthConfig] = useState({ googleClientId: null, allowedDomain: "umd.edu" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [cfg, me] = await Promise.allSettled([api.get("/auth/config"), api.get("/auth/me")]);
      if (cancelled) return;
      if (cfg.status === "fulfilled") {
        setAuthConfig(cfg.value);
      } else {
        console.error("[auth] Failed to load /api/auth/config:", cfg.reason);
      }
      if (me.status === "fulfilled") {
        setUser(me.value.user);
        setStatus("authenticated");
      } else {
        setStatus("anonymous");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loginWithGoogle = useCallback(async (credential) => {
    const { user: u, token } = await api.post("/auth/google", { credential });
    if (token) setSessionToken(token);
    setUser(u);
    setStatus("authenticated");
    return u;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } finally {
      setSessionToken(null);
      window.google?.accounts?.id?.disableAutoSelect?.();
      setUser(null);
      setStatus("anonymous");
    }
  }, []);

  // Any 401 from the API means our session is gone.
  const handleAuthError = useCallback((err) => {
    if (err?.status === 401) {
      setSessionToken(null);
      setUser(null);
      setStatus("anonymous");
      return true;
    }
    return false;
  }, []);

  return (
    <AuthContext.Provider value={{ user, setUser, status, authConfig, loginWithGoogle, logout, handleAuthError }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
