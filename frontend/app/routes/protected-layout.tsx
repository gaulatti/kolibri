import { useEffect, useRef, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "../auth/auth-context";
import { AppShell } from "../components/app-shell";
import { LoadingState } from "../components/loading-state";

export default function ProtectedLayout() {
  const { status, restoreSession } = useAuth();
  const location = useLocation();
  const restoreStarted = useRef(false);
  const [restoreFailed, setRestoreFailed] = useState(false);

  useEffect(() => {
    if (status !== "unauthenticated" || restoreStarted.current) return;
    restoreStarted.current = true;
    restoreSession(`${location.pathname}${location.search}`).catch(() => {
      setRestoreFailed(true);
    });
  }, [location.pathname, location.search, restoreSession, status]);

  if (status !== "authenticated" && !restoreFailed) {
    return (
      <AppShell>
        <LoadingState label="Restoring your session…" />
      </AppShell>
    );
  }

  if (restoreFailed) {
    const returnTo = `${location.pathname}${location.search}`;
    return (
      <Navigate
        to={`/sign-in?returnTo=${encodeURIComponent(returnTo)}`}
        replace
      />
    );
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
