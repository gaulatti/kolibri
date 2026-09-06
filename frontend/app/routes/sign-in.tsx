import {
  Button,
  Card,
  DashboardSection,
  ErrorState,
  PageHeader,
  StatusBadge,
} from "~/bleecker";
import { useState } from "react";
import { Navigate, useSearchParams } from "react-router";
import { useAuth } from "../auth/auth-context";
import { AppShell } from "../components/app-shell";
import { AppBreadcrumb } from "../components/app-breadcrumb";
import type { Route } from "./+types/sign-in";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Sign in | kolibri" },
    { name: "description", content: "Sign in to kolibri." },
  ];
}

export default function SignIn() {
  const { status, signIn } = useAuth();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const returnTo = safeReturnTo(searchParams.get("returnTo"));

  if (status === "authenticated") return <Navigate to="/" replace />;

  async function startSignIn() {
    setPending(true);
    setError(null);
    try {
      await signIn(returnTo);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Sign-in could not be started.",
      );
      setPending(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-2xl py-6 sm:py-12">
      <Card variant="elevated" padding="lg">
        <DashboardSection className="space-y-8">
          <PageHeader
            title="Sign in to kolibri"
            description="Continue to your private design-system operations workspace."
            breadcrumbs={
              <AppBreadcrumb
                items={[
                  { href: "/", label: "Home" },
                  { href: "/sign-in", label: "Sign in" },
                ]}
              />
            }
          />
          {searchParams.get("reason") === "session-expired" ? (
            <Card variant="subtle" padding="sm" role="status">
              <div className="flex items-center gap-3">
                <StatusBadge variant="warning" label="Session ended" />
                <p className="font-secondary text-sm text-text-secondary">
                  Sign in again to continue.
                </p>
              </div>
            </Card>
          ) : null}
          {searchParams.get("signedOut") ? (
            <Card variant="subtle" padding="sm" role="status">
              <div className="flex items-center gap-3">
                <StatusBadge variant="live" label="Signed out" />
                <p className="font-secondary text-sm text-text-secondary">
                  Your session closed securely.
                </p>
              </div>
            </Card>
          ) : null}
          {error ? (
            <ErrorState
              title="Sign-in could not be started"
              description={error}
            />
          ) : null}
          <Button
            fullWidth
            size="lg"
            type="button"
            onClick={startSignIn}
            loading={pending}
          >
            Continue with Google
          </Button>
        </DashboardSection>
      </Card>
      <p className="font-secondary mt-5 text-center text-xs leading-5 text-text-secondary">
        Authentication is completed securely through your organization.
      </p>
      </div>
    </AppShell>
  );
}

function safeReturnTo(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/";
}
