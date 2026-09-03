import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { SESSION_KEY } from "./api";
import type { AuthSession } from "./types";

interface AuthContextValue {
  session: AuthSession | null;
  signIn: (session: AuthSession) => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readSession(): AuthSession | null {
  try {
    const value = localStorage.getItem(SESSION_KEY);
    if (!value) return null;
    const session = JSON.parse(value) as AuthSession;
    if (
      !session.accessToken ||
      !session.user?.role ||
      !session.user.customerId
    ) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(readSession);

  function signIn(nextSession: AuthSession) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
    setSession(nextSession);
  }

  function signOut() {
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
  }

  useEffect(() => {
    window.addEventListener("bank-usac:unauthorized", signOut);
    return () => window.removeEventListener("bank-usac:unauthorized", signOut);
  }, []);

  return (
    <AuthContext.Provider value={{ session, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return context;
}
