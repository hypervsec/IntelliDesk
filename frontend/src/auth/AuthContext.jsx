import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import api, { AUTH_TOKEN_KEY, AUTH_UNAUTHORIZED_EVENT } from "../api/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [account, setAccount] = useState(null);

  const [loading, setLoading] = useState(true);

  const clearSession = useCallback(() => {
    localStorage.removeItem(AUTH_TOKEN_KEY);

    setAccount(null);
  }, []);

  const register = useCallback(async (registerData) => {
    const response = await api.post("/auth/register", registerData);

    return response.data;
  }, []);

  const login = useCallback(async (loginData) => {
    localStorage.removeItem(AUTH_TOKEN_KEY);

    const response = await api.post("/auth/login", loginData);

    const { access_token: accessToken, account: authenticatedAccount } =
      response.data;

    localStorage.setItem(AUTH_TOKEN_KEY, accessToken);

    setAccount(authenticatedAccount);

    return authenticatedAccount;
  }, []);

  const logout = useCallback(() => {
    clearSession();
  }, [clearSession]);

  const refreshAccount = useCallback(async () => {
    const accessToken = localStorage.getItem(AUTH_TOKEN_KEY);

    if (!accessToken) {
      setAccount(null);
      return null;
    }

    try {
      const response = await api.get("/auth/me");

      setAccount(response.data);

      return response.data;
    } catch (error) {
      clearSession();
      throw error;
    }
  }, [clearSession]);

  useEffect(() => {
    let componentIsActive = true;

    const initializeSession = async () => {
      const accessToken = localStorage.getItem(AUTH_TOKEN_KEY);

      if (!accessToken) {
        if (componentIsActive) {
          setLoading(false);
        }

        return;
      }

      try {
        const response = await api.get("/auth/me");

        if (componentIsActive) {
          setAccount(response.data);
        }
      } catch {
        if (componentIsActive) {
          clearSession();
        }
      } finally {
        if (componentIsActive) {
          setLoading(false);
        }
      }
    };

    const handleUnauthorized = () => {
      if (!componentIsActive) {
        return;
      }

      clearSession();
      setLoading(false);
    };

    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);

    initializeSession();

    return () => {
      componentIsActive = false;

      window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
    };
  }, [clearSession]);

  const contextValue = useMemo(
    () => ({
      account,
      loading,
      isAuthenticated: account !== null,
      register,
      login,
      logout,
      refreshAccount,
    }),
    [account, loading, register, login, logout, refreshAccount],
  );

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth, AuthProvider içinde kullanılmalıdır.");
  }

  return context;
}
