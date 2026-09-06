import { DashboardSection } from "~/bleecker";
import { useNavigate } from "react-router";
import { designSystemsApi } from "../api/design-systems";
import { DesignSystemForm } from "../design-systems/design-system-form";
import { PageHeading } from "../design-systems/page-heading";
import { AppBreadcrumb } from "../components/app-breadcrumb";
import type { Route } from "./+types/design-system-new";

export function meta({}: Route.MetaArgs) {
  return [{ title: "New design system | kolibri" }];
}

export default function NewDesignSystem() {
  const navigate = useNavigate();

  return (
    <DashboardSection className="space-y-10">
      <PageHeading
        title="Create a design system"
        description="Define the package identity and component contract before connecting its source."
        breadcrumbs={
          <AppBreadcrumb
            items={[
              { href: "/", label: "Home" },
              { href: "/design-systems", label: "Design Systems" },
              { href: "/design-systems/new", label: "New" },
            ]}
          />
        }
      />
      <DesignSystemForm
        submitLabel="Create design system"
        onSubmit={async (input) => {
          const created = await designSystemsApi.create(input);
          navigate(`/design-systems/${created.id}`, {
            replace: true,
            state: { notice: "Design system created." },
          });
        }}
      />
    </DashboardSection>
  );
}
