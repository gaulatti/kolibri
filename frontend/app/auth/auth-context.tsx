import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  cognitoAuth,
  type AuthSnapshot,
  type AuthenticatedIdentity,
} from "./cognito-auth.client";

type AuthContextValue = {
  status: "initializing" | "unauthenticated" | "authenticated";
  user: AuthenticatedIdentity | null;
  signIn: (returnTo?: string) => Promise<void>;
  restoreSession: (returnTo: string) => Promise<void>;
  completeCallback: (url: URL) => Promise<string>;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [snapshot, setSnapshot] = useState<AuthSnapshot | null>(null);

  useEffect(() => {
    setSnapshot(cognitoAuth.snapshot());
    return cognitoAuth.subscribe(setSnapshot);
  }, []);

  const signIn = useCallback(
    (returnTo?: string) => cognitoAuth.signIn(returnTo),
    [],
  );
  const restoreSession = useCallback(
    (returnTo: string) => cognitoAuth.restoreSession(returnTo),
    [],
  );
  const completeCallback = useCallback(
    (url: URL) => cognitoAuth.completeCallback(url),
    [],
  );
  const signOut = useCallback(() => cognitoAuth.signOut(), []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status: snapshot?.status ?? "initializing",
      user: snapshot?.user ?? null,
      signIn,
      restoreSession,
      completeCallback,
      signOut,
    }),
    [completeCallback, restoreSession, signIn, signOut, snapshot],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
