import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";
import {
  BleeckerThemeScript,
  Button,
  DashboardSection,
  ErrorState,
  PageHeader,
  ThemeProvider,
} from "~/bleecker";

import type { Route } from "./+types/root";
import { AuthProvider } from "./auth/auth-context";
import { ApplicationFrame } from "./components/app-shell";
import { AppBreadcrumb } from "./components/app-breadcrumb";
import { LoadingState } from "./components/loading-state";
import "./app.css";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "kolibri" },
    {
      name: "description",
      content: "Generate versioned design-system packages from Figma.",
    },
  ];
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        <BleeckerThemeScript storageKey="kolibri-theme" />
      </head>
      <body className="bg-light-sand/30 text-text-primary dark:bg-background">
        <ThemeProvider defaultTheme="system" storageKey="kolibri-theme">
          {children}
        </ThemeProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  );
}

export function HydrateFallback() {
  return (
    <ApplicationFrame>
      <LoadingState label="Opening kolibri…" />
    </ApplicationFrame>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Something went wrong";
  let details = "kolibri could not open this page. Please try again.";

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  }

  return (
    <ApplicationFrame>
      <DashboardSection className="mx-auto w-full max-w-3xl py-6 sm:py-12">
        <PageHeader
          className="border-b border-sand/25 pb-8 dark:border-white/[0.08]"
          title={message}
          breadcrumbs={
            <AppBreadcrumb
              items={[
                { href: "/", label: "Home" },
                { href: "#", label: message },
              ]}
            />
          }
        />
        <ErrorState title={message} description={details} />
        <Button as="a" href="/design-systems">
          Design Systems
        </Button>
      </DashboardSection>
    </ApplicationFrame>
  );
}
