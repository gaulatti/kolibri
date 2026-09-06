import {
  Card,
  DashboardSection,
  DataList,
  DataTable,
  Empty,
  ErrorState,
  PageHeader,
} from "~/bleecker";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { ApiError } from "../api/api-client";
import { designSystemsApi, type DesignSystem } from "../api/design-systems";
import type { GenerationHistoryReport } from "../api/reports";
import { reportsApi } from "../api/reports";
import { AppBreadcrumb } from "../components/app-breadcrumb";
import { LoadingState } from "../components/loading-state";
import { RouterButton } from "../components/router-button";
import { formatTimestamp, statusLabel } from "../generations/generation-format";
import {
  filtersFromSearchParams,
  withPage,
} from "../generations/history-filters";
import { PaginationControls } from "../generations/pagination-controls";
import type { Route } from "./+types/generation-history-report";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Generation History Report | kolibri" }];
}

export default function GenerationHistoryReportView({
  params,
}: Route.ComponentProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryKey = searchParams.toString();
  const filters = useMemo(
    () => ({
      ...filtersFromSearchParams(searchParams),
      designSystemId: params.designSystemId,
    }),
    [queryKey, params.designSystemId],
  );
  const [report, setReport] = useState<GenerationHistoryReport | null>(null);
  const [designSystem, setDesignSystem] = useState<DesignSystem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setReport(await reportsApi.generationHistory(filters));
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "The generation history report could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  useEffect(() => {
    let active = true;
    designSystemsApi
      .get(params.designSystemId)
      .then((result) => {
        if (active) setDesignSystem(result);
      })
      .catch(() => {
        // The report request remains authoritative for owner-scoped access.
      });
    return () => {
      active = false;
    };
  }, [params.designSystemId]);

  return (
    <DashboardSection className="space-y-10">
      <PageHeader
        className="border-b border-sand/25 pb-8 dark:border-white/[0.08]"
        title={report?.title || "Generation History Report"}
        description={
          report
            ? `Generated ${formatTimestamp(report.generatedAt)}`
            : undefined
        }
        breadcrumbs={
          <AppBreadcrumb
            items={[
              { href: "/", label: "Home" },
              { href: "/design-systems", label: "Design Systems" },
              {
                href: `/design-systems/${params.designSystemId}`,
                label: designSystem?.name || "Design system",
              },
              {
                href: `/design-systems/${params.designSystemId}?tab=history`,
                label: "History",
              },
              {
                href: `/design-systems/${params.designSystemId}/history/report`,
                label: "Report",
              },
            ]}
          />
        }
        actions={
          <RouterButton
            variant="secondary"
            to={`/design-systems/${params.designSystemId}?tab=history${queryKey ? `&${queryKey}` : ""}`}
          >
            Change filters
          </RouterButton>
        }
      />

      {loading ? <LoadingState label="Generating onscreen report…" /> : null}

      {!loading && error ? (
        <ErrorState
          title="Report unavailable"
          description={error}
          onRetry={loadReport}
          retryLabel="Try again"
        />
      ) : null}

      {!loading && !error && report ? (
        <>
          <Card variant="subtle" padding="lg">
            <DashboardSection
              title="Applied filters"
              description="The report reflects this saved operational view."
            >
              <DataList
                items={[
                {
                  id: "text",
                  label: "Text",
                  value: report.appliedFilters.text || "All",
                },
                {
                  id: "system",
                  label: "Design system",
                  value: designSystem?.name || "Current design system",
                },
                {
                  id: "status",
                  label: "Status",
                  value: report.appliedFilters.status
                    ? statusLabel(report.appliedFilters.status)
                    : "All",
                },
                {
                  id: "start",
                  label: "Start date",
                  value: report.appliedFilters.startDate || "Any",
                },
                {
                  id: "end",
                  label: "End date",
                  value: report.appliedFilters.endDate || "Any",
                },
                {
                  id: "order",
                  label: "Order",
                  value:
                    report.appliedFilters.sortDirection === "desc"
                      ? "Newest first"
                      : "Oldest first",
                },
                {
                  id: "page",
                  label: "Page",
                  value: `${report.appliedFilters.page} · ${report.appliedFilters.pageSize} rows per page`,
                },
                ]}
              />
            </DashboardSection>
          </Card>

          {report.rows.length === 0 ? (
            <Empty
              title="No results"
              action={
                <RouterButton
                  variant="secondary"
                  to={`/design-systems/${params.designSystemId}?tab=history`}
                >
                  Reset history filters
                </RouterButton>
              }
            />
          ) : (
            <>
              <DataTable
                caption="Generation history report"
                data={report.rows}
                getRowKey={(row, index) =>
                  `${row.packageName}-${row.startedAt || "pending"}-${index}`
                }
                columns={report.columns.map((column) => ({
                  key: column.key,
                  header: column.label,
                  sortable: false,
                  align: isNumericReportColumn(column.key) ? "right" : "left",
                  className: isNumericReportColumn(column.key)
                    ? "tabular-nums"
                    : undefined,
                  cell: (row: GenerationHistoryReport["rows"][number]) =>
                    formatReportCell(column.key, row[column.key]),
                }))}
              />
              <PaginationControls
                pagination={report.pagination}
                onPage={(page) => setSearchParams(withPage(searchParams, page))}
              />
            </>
          )}
        </>
      ) : null}
    </DashboardSection>
  );
}

function isNumericReportColumn(key: string) {
  return [
    "artifactCount",
    "componentCount",
    "tokenCount",
    "warningCount",
    "errorCount",
  ].includes(key);
}

function formatReportCell(
  key: string,
  value: string | number | boolean | null,
) {
  if (key === "startedAt" || key === "completedAt") {
    return value ? formatTimestamp(String(value)) : "Not yet";
  }
  if (key === "status")
    return statusLabel(value as "pending" | "running" | "succeeded" | "failed");
  if (key === "artifactAvailable") return value ? "Yes" : "No";
  return typeof value === "number"
    ? value.toLocaleString()
    : String(value ?? "—");
}
