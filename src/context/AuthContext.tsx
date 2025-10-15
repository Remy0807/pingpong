import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getCurrentUser, loginUser, registerUser, setAuthToken } from "../lib/api";
import type { AuthResponse, AuthUser } from "../types";

type LoginPayload = {
  username?: string;
  email?: string;
  password: string;
};

type RegisterPayload = {
  username: string;
  email?: string;
  password: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  initializing: boolean;
  authError: string | null;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
  clearError: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const STORAGE_KEY = "pingpong_auth_token";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const applyToken = useCallback((value: string | null) => {
    setToken(value);
    setAuthToken(value);
    if (value) {
      localStorage.setItem(STORAGE_KEY, value);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const handleAuthSuccess = useCallback(
    (response: AuthResponse) => {
      applyToken(response.token);
      setUser(response.user);
      setAuthError(null);
    },
    [applyToken]
  );

  const clearError = useCallback(() => {
    setAuthError(null);
  }, []);

  const login = useCallback(
    async (payload: LoginPayload) => {
      setAuthError(null);
      try {
        const response = await loginUser(payload);
        handleAuthSuccess(response);
      } catch (error) {
        setAuthError(error instanceof Error ? error.message : "Inloggen mislukt.");
        throw error;
      }
    },
    [handleAuthSuccess]
  );

  const register = useCallback(
    async (payload: RegisterPayload) => {
      setAuthError(null);
      try {
        const response = await registerUser(payload);
        handleAuthSuccess(response);
      } catch (error) {
        setAuthError(error instanceof Error ? error.message : "Registreren mislukt.");
        throw error;
      }
    },
    [handleAuthSuccess]
  );

  const logout = useCallback(() => {
    applyToken(null);
    setUser(null);
  }, [applyToken]);

  const refreshProfile = useCallback(async () => {
    if (!token) {
      setUser(null);
      return;
    }
    try {
      const { user: profile } = await getCurrentUser();
      setUser(profile);
    } catch (error) {
      console.error("Kon profiel niet ophalen", error);
      applyToken(null);
      setUser(null);
      throw error;
    }
  }, [applyToken, token]);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      setInitializing(false);
      return;
    }

    applyToken(stored);
    getCurrentUser()
      .then(({ user: profile }) => {
        setUser(profile);
      })
      .catch((error) => {
        console.error("Kon opgeslagen sessie niet herstellen", error);
        applyToken(null);
        setUser(null);
      })
      .finally(() => {
        setInitializing(false);
      });
  }, [applyToken]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      initializing,
      authError,
      login,
      register,
      logout,
      refreshProfile,
      clearError
    }),
    [authError, initializing, login, logout, refreshProfile, register, token, user, clearError]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
