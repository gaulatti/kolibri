import {
  Card,
  DashboardGrid,
  DashboardSection,
  DataList,
  Empty,
  ErrorState,
  LineChart,
  PageHeader,
  ScatterChart,
  StatCard,
  StatusBadge,
} from "~/bleecker";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError } from "../api/api-client";
import {
  dashboardApi,
  type DashboardDesignSystemHealth,
  type DashboardReport,
} from "../api/dashboard";
import { AppBreadcrumb } from "../components/app-breadcrumb";
import { LoadingState } from "../components/loading-state";
import { RouterButton } from "../components/router-button";

export default function Home() {
  const [report, setReport] = useState<DashboardReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setReport(await dashboardApi.get());
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "The portfolio report could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const volume = useMemo(() => volumeChart(report), [report]);
  const performance = useMemo(() => performanceChart(report), [report]);
  const efficiency = useMemo(() => efficiencyChart(report), [report]);

  return (
    <DashboardSection className="space-y-12">
      <PageHeader
        className="border-b border-sand/25 pb-8 dark:border-white/[0.08]"
        title="Portfolio overview"
        description={
          report
            ? `Design-system health and generation performance · Updated ${formatTimestamp(report.generatedAt)}`
            : "Design-system health and generation performance."
        }
        breadcrumbs={<AppBreadcrumb items={[{ href: "/", label: "Home" }]} />}
        actions={
          <RouterButton variant="secondary" to="/design-systems">
            Manage design systems
          </RouterButton>
        }
      />

      {loading ? <LoadingState label="Loading portfolio health…" /> : null}

      {!loading && error ? (
        <ErrorState
          title="Portfolio report unavailable"
          description={error}
          onRetry={loadDashboard}
          retryLabel="Try again"
        />
      ) : null}

      {!loading && !error && report?.designSystems.length === 0 ? (
        <Empty
          title="No Design Systems"
          description="Create a Design System to begin tracking portfolio health."
          action={
            <RouterButton to="/design-systems/new">
              Create a Design System
            </RouterButton>
          }
        />
      ) : null}

      {!loading && !error && report && report.designSystems.length > 0 ? (
        <>
          <DashboardSection
            title="Portfolio"
            description={`Operational health across the last ${report.periodDays} days.`}
          >
            <DashboardGrid columns={5}>
              <StatCard
                title="Design Systems"
                value={report.summary.totalDesignSystems}
                className="shadow-[var(--shadow-raised)]"
              />
              <StatCard
                title="Need attention"
                value={report.summary.requiringAttention}
              />
              <StatCard
                title="Generation success"
                value={formatPercentage(report.summary.successRate)}
                description={`${report.summary.failedRuns} failed in ${report.periodDays} days`}
              />
              <StatCard
                title="p95 duration"
                value={formatDuration(report.summary.p95DurationMs)}
              />
              <StatCard
                title="npm publication"
                value={formatPercentage(
                  report.summary.publicationSuccessRate,
                  "Not used",
                )}
              />
            </DashboardGrid>
          </DashboardSection>

          <Card variant="elevated" padding="lg">
            <DashboardSection
              title="Generation volume"
              description={`${report.summary.generatedRuns} runs in the last ${report.periodDays} days`}
            >
              <LineChart
                data={volume.data}
                xAxisKey="date"
                series={volume.series}
                height={340}
                yAxisTickFormatter={(value) => String(Math.round(value))}
              />
            </DashboardSection>
          </Card>

          <DashboardGrid columns={2}>
            <Card variant="outlined" padding="lg">
              <DashboardSection
                title="Service performance"
                description="Median and p95 generation duration by day"
              >
                {performance.length ? (
                  <LineChart
                    data={performance}
                    xAxisKey="date"
                    series={[
                      { key: "median", name: "Median duration" },
                      { key: "p95", name: "p95 duration" },
                    ]}
                    height={300}
                    xAxisLabel="Day"
                    yAxisLabel="Duration"
                    yAxisTickFormatter={formatChartSeconds}
                    tooltipFormatter={formatChartSeconds}
                  />
                ) : (
                  <Empty title="No completed generations in this period" />
                )}
              </DashboardSection>
            </Card>

            <Card variant="outlined" padding="lg">
              <DashboardSection
                title="Generation efficiency"
                description="Each bubble is a generated package; bubble size reflects artifact count"
              >
                {efficiency.generation.length +
                  efficiency.generationWithNpm.length >
                0 ? (
                  <ScatterChart
                    data={[]}
                    series={[
                      {
                        key: "generation",
                        name: "Generation",
                        xKey: "components",
                        yKey: "duration",
                        zKey: "artifacts",
                        data: efficiency.generation,
                      },
                      {
                        key: "generation-with-npm",
                        name: "Generation + NPM",
                        xKey: "components",
                        yKey: "duration",
                        zKey: "artifacts",
                        data: efficiency.generationWithNpm,
                      },
                    ]}
                    height={300}
                    xAxisLabel="Components"
                    yAxisLabel="Duration"
                    xAxisTickFormatter={(value) =>
                      String(Math.round(Number(value)))
                    }
                    yAxisTickFormatter={(value) =>
                      formatChartSeconds(Number(value))
                    }
                  />
                ) : (
                  <Empty title="No generated packages in this period" />
                )}
              </DashboardSection>
            </Card>
          </DashboardGrid>

          <Card variant="outlined" padding="lg">
            <DashboardSection title="Design System Health">
              <DataList
                items={report.designSystems.map((designSystem) => ({
                  id: designSystem.id,
                  label: (
                    <RouterButton
                      variant="secondary"
                      size="sm"
                      to={`/design-systems/${designSystem.id}`}
                    >
                      {designSystem.name}
                    </RouterButton>
                  ),
                  value: <HealthBadge designSystem={designSystem} />,
                  description: (
                    <span className="block pt-2">
                      {healthDescription(designSystem)}
                    </span>
                  ),
                }))}
              />
            </DashboardSection>
          </Card>
        </>
      ) : null}
    </DashboardSection>
  );
}

function volumeChart(report: DashboardReport | null) {
  if (!report) return { data: [], series: [] };
  const keys = new Map(
    report.designSystems.map((designSystem, index) => [
      designSystem.id,
      `designSystem${index}`,
    ]),
  );
  return {
    data: report.generationVolume.map((point) => ({
      date: formatChartDate(point.date),
      ...Object.fromEntries(
        point.counts.map((count) => [
          keys.get(count.designSystemId)!,
          count.count,
        ]),
      ),
    })),
    series: report.designSystems.map((designSystem) => ({
      key: keys.get(designSystem.id)!,
      name: designSystem.name,
    })),
  };
}

function performanceChart(report: DashboardReport | null) {
  return (
    report?.performance
      .filter(
        (point) =>
          point.medianDurationMs !== null || point.p95DurationMs !== null,
      )
      .map((point) => ({
        date: formatChartDate(point.date),
        median:
          point.medianDurationMs === null
            ? null
            : point.medianDurationMs / 1_000,
        p95: point.p95DurationMs === null ? null : point.p95DurationMs / 1_000,
      })) ?? []
  );
}

function efficiencyChart(report: DashboardReport | null) {
  const runs = report?.generationEfficiency ?? [];
  const point = (run: (typeof runs)[number]) => ({
    components: run.componentCount,
    duration: run.durationMs / 1_000,
    artifacts: run.artifactCount,
  });
  return {
    generation: runs.filter((run) => !run.publishRequested).map(point),
    generationWithNpm: runs.filter((run) => run.publishRequested).map(point),
  };
}

function HealthBadge({
  designSystem,
}: {
  designSystem: DashboardDesignSystemHealth;
}) {
  if (designSystem.health === "healthy")
    return <StatusBadge variant="live" label="Healthy" />;
  if (designSystem.health === "unproven")
    return <StatusBadge variant="default" label="Unproven" />;
  return <StatusBadge variant="warning" label="Needs attention" />;
}

function healthDescription(designSystem: DashboardDesignSystemHealth) {
  const version = designSystem.currentVersion
    ? `v${designSystem.currentVersion}`
    : null;
  const components =
    designSystem.componentCount === null
      ? null
      : `${designSystem.componentCount} components${formatDelta(designSystem.componentDelta)}`;
  const diagnostics =
    designSystem.warningCount === null || designSystem.errorCount === null
      ? null
      : `${designSystem.warningCount} warnings · ${designSystem.errorCount} errors`;
  return [
    designSystem.attentionReason,
    version,
    components,
    diagnostics,
  ]
    .filter(Boolean)
    .join(" · ");
}

function formatDelta(value: number | null) {
  if (value === null || value === 0) return "";
  return ` (${value > 0 ? "+" : ""}${value})`;
}

function formatPercentage(value: number | null, fallback = "—") {
  return value === null ? fallback : `${value.toLocaleString()}%`;
}

function formatDuration(milliseconds: number | null) {
  if (milliseconds === null) return "—";
  const seconds = milliseconds / 1_000;
  if (seconds < 60) return `${seconds.toLocaleString()} sec`;
  return `${(seconds / 60).toLocaleString(undefined, { maximumFractionDigits: 1 })} min`;
}

function formatChartSeconds(value: number) {
  return value < 60
    ? `${value.toLocaleString()}s`
    : `${(value / 60).toFixed(1)}m`;
}

function formatChartDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
