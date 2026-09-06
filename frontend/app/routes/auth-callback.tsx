import {
  Button,
  DashboardSection,
  ErrorState,
  PageHeader,
} from "~/bleecker";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../auth/auth-context";
import { AppShell } from "../components/app-shell";
import { AppBreadcrumb } from "../components/app-breadcrumb";
import { LoadingState } from "../components/loading-state";
import type { Route } from "./+types/auth-callback";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Completing sign-in | kolibri" }];
}

export default function AuthCallback() {
  const { completeCallback } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const completion = useRef<Promise<string> | null>(null);

  useEffect(() => {
    let active = true;
    completion.current ??= completeCallback(new URL(window.location.href));
    completion.current
      .then((returnTo) => {
        if (active) navigate(returnTo, { replace: true });
      })
      .catch((cause: unknown) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : "Sign-in could not be completed.",
          );
      });
    return () => {
      active = false;
    };
  }, [completeCallback, navigate]);

  return (
    <AppShell>
      <DashboardSection className="mx-auto w-full max-w-2xl py-6 sm:py-12">
        <PageHeader
          className="border-b border-sand/25 pb-8 dark:border-white/[0.08]"
          title="Sign in"
          breadcrumbs={
            <AppBreadcrumb
              items={[
                { href: "/", label: "Home" },
                { href: "/sign-in", label: "Sign in" },
                { href: "/auth/callback", label: "Callback" },
              ]}
            />
          }
        />
        {error ? (
          <>
            <ErrorState title="Sign-in needs another try" description={error} />
            <Button as="a" href="/sign-in">
              Return to sign in
            </Button>
          </>
        ) : (
          <LoadingState label="Completing sign-in…" />
        )}
      </DashboardSection>
    </AppShell>
  );
}
