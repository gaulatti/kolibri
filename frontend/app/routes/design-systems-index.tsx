import {
  Card,
  DashboardGrid,
  DashboardSection,
  DataList,
  Empty,
  ErrorState,
  StatusBadge,
} from "~/bleecker";
import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router";
import { ApiError } from "../api/api-client";
import { designSystemsApi, type DesignSystem } from "../api/design-systems";
import { LoadingState } from "../components/loading-state";
import { AppBreadcrumb } from "../components/app-breadcrumb";
import { RouterButton } from "../components/router-button";
import { PageHeading } from "../design-systems/page-heading";
import type { Route } from "./+types/design-systems-index";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Design Systems | kolibri" }];
}

export default function DesignSystemsIndex() {
  const [designSystems, setDesignSystems] = useState<DesignSystem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const location = useLocation();
  const notice = readNotice(location.state);

  const loadDesignSystems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDesignSystems(await designSystemsApi.list());
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Your design systems could not be loaded. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDesignSystems();
  }, [loadDesignSystems]);

  return (
    <DashboardSection className="space-y-10">
      <PageHeading
        title="Design Systems"
        description="Manage sources, package configuration, credentials, and generation history."
        breadcrumbs={
          <AppBreadcrumb
            items={[
              { href: "/", label: "Home" },
              { href: "/design-systems", label: "Design Systems" },
            ]}
          />
        }
        action={{ label: "New design system", to: "/design-systems/new" }}
      />

      {notice ? (
        <div role="status">
          <StatusBadge variant="live" label={notice} />
        </div>
      ) : null}

      {loading ? <LoadingState label="Loading design systems…" /> : null}

      {!loading && error ? (
        <ErrorState
          title="We couldn't load your design systems"
          description={error}
          onRetry={loadDesignSystems}
          retryLabel="Try again"
        />
      ) : null}

      {!loading && !error && designSystems.length === 0 ? (
        <Empty
          title="Create your first design system"
          description="Add a source and package configuration to get started."
          action={
            <RouterButton to="/design-systems/new">
              Create a design system
            </RouterButton>
          }
        />
      ) : null}

      {!loading && !error && designSystems.length > 0 ? (
        <DashboardGrid columns={2}>
          {designSystems.map((designSystem) => (
            <Card
              key={designSystem.id}
              variant="outlined"
              padding="lg"
              className="hover:border-sand/65 hover:shadow-[var(--shadow-surface)] dark:hover:border-white/20"
            >
              <DashboardSection
                title={designSystem.name}
                description={designSystem.description || undefined}
                action={
                  <RouterButton
                    variant="secondary"
                    size="sm"
                    to={`/design-systems/${designSystem.id}`}
                  >
                    View
                  </RouterButton>
                }
              >
                <DataList
                  items={[
                    {
                      id: "updated",
                      label: "Last updated",
                      value: formatDate(designSystem.updatedAt),
                    },
                  ]}
                />
              </DashboardSection>
            </Card>
          ))}
        </DashboardGrid>
      ) : null}
    </DashboardSection>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function readNotice(state: unknown) {
  if (!state || typeof state !== "object" || !("notice" in state)) return null;
  return typeof state.notice === "string" ? state.notice : null;
}
