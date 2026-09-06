import {
  DashboardSection,
  ErrorState,
  PageHeader,
  StatusBadge,
  Tabs,
} from "~/bleecker";
import { useEffect, useState } from "react";
import { useLocation, useSearchParams } from "react-router";
import { ApiError } from "../api/api-client";
import { designSystemsApi, type DesignSystem } from "../api/design-systems";
import { LoadingState } from "../components/loading-state";
import { AppBreadcrumb } from "../components/app-breadcrumb";
import { RouterButton } from "../components/router-button";
import { RuntimeConfigurationForm } from "../design-systems/runtime-configuration-form";
import { GenerationLauncher } from "../generations/generation-launcher";
import type { Route } from "./+types/design-system-detail";
import { DesignSystemHistory } from "./generation-history";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Design system | kolibri" }];
}

export default function DesignSystemDetail({ params }: Route.ComponentProps) {
  const [designSystem, setDesignSystem] = useState<DesignSystem | null>(null);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const notice = readNotice(location.state);
  const activeTab = detailTab(searchParams.get("tab"));

  useEffect(() => {
    let active = true;
    designSystemsApi
      .get(params.designSystemId)
      .then((result) => {
        if (active) setDesignSystem(result);
      })
      .catch((cause: unknown) => {
        if (active) {
          setLoadingError(
            cause instanceof ApiError
              ? cause.message
              : "This design system could not be loaded.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, [params.designSystemId]);

  if (loadingError) {
    return (
      <DashboardSection>
        <AppBreadcrumb
          items={[
            { href: "/", label: "Home" },
            { href: "/design-systems", label: "Design Systems" },
            {
              href: `/design-systems/${params.designSystemId}`,
              label: "Design system",
            },
          ]}
        />
        <ErrorState
          title="Design system unavailable"
          description={loadingError}
        />
        <RouterButton variant="secondary" to="/design-systems">
          Return to Design Systems
        </RouterButton>
      </DashboardSection>
    );
  }

  if (!designSystem)
    return (
      <DashboardSection>
        <AppBreadcrumb
          items={[
            { href: "/", label: "Home" },
            { href: "/design-systems", label: "Design Systems" },
            {
              href: `/design-systems/${params.designSystemId}`,
              label: "Design system",
            },
          ]}
        />
        <LoadingState label="Loading design system…" />
      </DashboardSection>
    );

  return (
    <DashboardSection className="space-y-10">
      {notice ? (
        <div role="status">
          <StatusBadge variant="live" label={notice} />
        </div>
      ) : null}

      <PageHeader
        className="border-b border-sand/25 pb-8 dark:border-white/[0.08]"
        title={designSystem.name}
        description={
          designSystem.description ||
          "Configure, generate, and review this design-system package."
        }
        breadcrumbs={
          <AppBreadcrumb
            items={[
              { href: "/", label: "Home" },
              { href: "/design-systems", label: "Design Systems" },
              {
                href: `/design-systems/${designSystem.id}`,
                label: designSystem.name,
              },
              ...(activeTab === "history"
                ? [
                    {
                      href: `/design-systems/${designSystem.id}?tab=history`,
                      label: "History",
                    },
                  ]
                : []),
            ]}
          />
        }
        actions={
          <RouterButton
            variant="secondary"
            to={`/design-systems/${designSystem.id}/edit`}
          >
            Edit
          </RouterButton>
        }
      />

      <Tabs
        aria-label={`${designSystem.name} workspace`}
        className="overflow-x-auto"
        activeTab={activeTab}
        onChange={(tab) => {
          const next = new URLSearchParams(searchParams);
          if (tab === "generate") next.delete("tab");
          else next.set("tab", tab);
          setSearchParams(next, { replace: true });
        }}
        tabs={[
          { id: "generate", label: "Generate", panelId: "generate-panel" },
          {
            id: "configuration",
            label: "Configuration",
            panelId: "configuration-panel",
          },
          {
            id: "credentials",
            label: "Credentials",
            panelId: "credentials-panel",
          },
          { id: "history", label: "History", panelId: "history-panel" },
        ]}
      />

      {activeTab === "generate" ? (
        <div id="generate-panel" role="tabpanel">
          <GenerationLauncher
            designSystem={designSystem}
            onConfigure={() => setSearchParams({ tab: "configuration" })}
            onCredentials={() => setSearchParams({ tab: "credentials" })}
          />
        </div>
      ) : null}

      {activeTab === "configuration" ? (
        <div id="configuration-panel" role="tabpanel">
          <RuntimeConfigurationForm
            designSystemId={designSystem.id}
            view="configuration"
          />
        </div>
      ) : null}

      {activeTab === "credentials" ? (
        <div id="credentials-panel" role="tabpanel">
          <RuntimeConfigurationForm
            designSystemId={designSystem.id}
            view="credentials"
          />
        </div>
      ) : null}

      {activeTab === "history" ? (
        <div id="history-panel" role="tabpanel">
          <DesignSystemHistory designSystemId={designSystem.id} />
        </div>
      ) : null}
    </DashboardSection>
  );
}

function detailTab(value: string | null) {
  return ["configuration", "credentials", "history"].includes(value || "")
    ? (value as "generate" | "configuration" | "credentials" | "history")
    : "generate";
}

function readNotice(state: unknown) {
  if (!state || typeof state !== "object" || !("notice" in state)) return null;
  return typeof state.notice === "string" ? state.notice : null;
}
