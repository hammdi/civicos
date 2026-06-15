import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, tokens } from "../api/client";
import type { User } from "../api/types";

interface RegisterInput {
  phone: string;
  name: string;
  email?: string;
  password?: string;
  city?: string;
}

interface AuthState {
  user: User | null;
  phone: string | null;
  isAuthenticated: boolean;
  requestOtp: (phone: string) => Promise<{ debug_otp: string | null; is_new_user: boolean }>;
  register: (input: RegisterInput) => Promise<{ debug_otp: string | null }>;
  verifyOtp: (
    phone: string,
    otp: string,
    profile?: { name?: string; email?: string; city?: string }
  ) => Promise<void>;
  loginPassword: (identifier: string, password: string) => Promise<void>;
  updateUser: (user: User) => void;
  refresh: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(tokens.citizenUser());

  // Re-validate the stored session once on mount.
  useEffect(() => {
    if (tokens.citizen()) {
      api.auth
        .me()
        .then((u) => {
          tokens.setCitizenUser(u);
          setUser(u);
        })
        .catch(() => {
          tokens.clearCitizen();
          setUser(null);
        });
    }
  }, []);

  const requestOtp = useCallback(async (phone: string) => {
    const res = await api.auth.requestOtp(phone);
    return { debug_otp: res.debug_otp, is_new_user: res.is_new_user };
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const res = await api.auth.register(input);
    return { debug_otp: res.debug_otp };
  }, []);

  const verifyOtp = useCallback(
    async (phone: string, otp: string, profile?: { name?: string; email?: string; city?: string }) => {
      const token = await api.auth.verifyOtp(phone, otp, profile);
      tokens.setCitizen(token);
      setUser(token.user);
    },
    []
  );

  const loginPassword = useCallback(async (identifier: string, password: string) => {
    const token = await api.auth.login(identifier, password);
    tokens.setCitizen(token);
    setUser(token.user);
  }, []);

  const updateUser = useCallback((u: User) => {
    tokens.setCitizenUser(u);
    setUser(u);
  }, []);

  const refresh = useCallback(async () => {
    const u = await api.auth.me();
    updateUser(u);
  }, [updateUser]);

  const logout = useCallback(() => {
    tokens.clearCitizen();
    setUser(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      phone: user?.phone ?? null,
      isAuthenticated: Boolean(user && tokens.citizen()),
      requestOtp,
      register,
      verifyOtp,
      loginPassword,
      updateUser,
      refresh,
      logout,
    }),
    [user, requestOtp, register, verifyOtp, loginPassword, updateUser, refresh, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
