import {
  AppShell as BleeckerAppShell,
  Avatar,
  Button,
  Header,
  ThemeToggle,
  type RenderLink,
} from "~/bleecker";
import { NavLink } from "react-router";
import { useAuth } from "../auth/auth-context";
import type { AuthenticatedIdentity } from "../auth/cognito-auth.client";

const navigation = [
  { href: "/", label: "Home" },
  { href: "/design-systems", label: "Design Systems" },
];

const renderLink: RenderLink = ({ item, className, children, onClick }) => (
  <NavLink to={item.href} className={className} onClick={onClick}>
    {children}
  </NavLink>
);

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();

  return (
    <ApplicationFrame user={user} onSignOut={signOut}>
      {children}
    </ApplicationFrame>
  );
}

export function ApplicationFrame({
  children,
  user = null,
  onSignOut,
}: {
  children: React.ReactNode;
  user?: AuthenticatedIdentity | null;
  onSignOut?: () => void;
}) {
  const displayName = user?.displayName || "kolibri user";

  function HeaderActions() {
    return (
      <>
        {user ? (
          <Avatar fallback={displayName} alt={displayName} size="sm" />
        ) : null}
        <ThemeToggle aria-label="Change color theme" />
        {user && onSignOut ? (
          <Button variant="ghost" size="sm" type="button" onClick={onSignOut}>
            Sign out
          </Button>
        ) : null}
      </>
    );
  }

  return (
    <BleeckerAppShell
      className="antialiased"
      contentClassName="bg-light-sand/30 dark:bg-background"
      offsetHeader
      header={
        <Header
          brand={{
            href: user ? "/" : "/sign-in",
            name: "kolibri",
            logoAlt: "kolibri",
          }}
          navigation={user ? navigation : []}
          actions={<HeaderActions />}
          mobileActions={<HeaderActions />}
          renderLink={renderLink}
        />
      }
    >
      <div className="container mx-auto w-full max-w-7xl flex-1">
        <div className="space-y-10 px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-14">
          {children}
        </div>
      </div>
    </BleeckerAppShell>
  );
}
