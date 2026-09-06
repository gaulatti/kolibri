import { DashboardSection, ErrorState, PageHeader } from "~/bleecker";
import { AppBreadcrumb } from "../components/app-breadcrumb";
import { AppShell } from "../components/app-shell";
import { RouterButton } from "../components/router-button";

export default function NotFound() {
  return (
    <AppShell>
      <DashboardSection className="mx-auto w-full max-w-3xl py-6 sm:py-12">
        <PageHeader
          className="border-b border-sand/25 pb-8 dark:border-white/[0.08]"
          title="Page not found"
          breadcrumbs={
            <AppBreadcrumb
              items={[
                { href: "/", label: "Home" },
                { href: "#", label: "Not found" },
              ]}
            />
          }
        />
        <ErrorState
          title="Page not found"
          description="The address doesn't match a kolibri page."
        />
        <RouterButton to="/design-systems">Design Systems</RouterButton>
      </DashboardSection>
    </AppShell>
  );
}
