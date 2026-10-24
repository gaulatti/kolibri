import {
  Button,
  DashboardSection,
  DataTable,
  Empty,
  ErrorState,
  StatusBadge as BleeckerStatusBadge,
} from "~/bleecker";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { ApiError } from "../api/api-client";
import {
  generationsApi,
  type GenerationHistoryResult,
  type GenerationStatus,
} from "../api/generations";
import { LoadingState } from "../components/loading-state";
import { RouterButton } from "../components/router-button";
import { formatTimestamp, statusLabel } from "../generations/generation-format";
import { HistoryFilterForm } from "../generations/history-filter-form";
import {
  filtersFromSearchParams,
  formValueFromFilters,
  searchParamsFromForm,
  validateHistoryFilters,
  withPage,
  type HistoryFilterErrors,
  type HistoryFilterFormValue,
} from "../generations/history-filters";
import { PaginationControls } from "../generations/pagination-controls";

export function DesignSystemHistory({
  designSystemId,
}: {
  designSystemId: string;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const searchKey = searchParams.toString();
  const filterSearchParams = useMemo(() => {
    const next = new URLSearchParams(searchParams);
    next.delete("tab");
    return next;
  }, [searchKey]);
  const queryKey = filterSearchParams.toString();
  const filters = useMemo(
    () => ({
      ...filtersFromSearchParams(filterSearchParams),
      designSystemId,
    }),
    [queryKey, designSystemId],
  );
  const [formValue, setFormValue] = useState(() =>
    formValueFromFilters(filters),
  );
  const [filterErrors, setFilterErrors] = useState<HistoryFilterErrors>({});
  const [result, setResult] = useState<GenerationHistoryResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadId, setDownloadId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    setFormValue(formValueFromFilters(filters));
  }, [filters]);

  const loadHistory = useCallback(async () => {
    const urlErrors = validateHistoryFilters(formValueFromFilters(filters));
    setFilterErrors(urlErrors);
    if (Object.keys(urlErrors).length) {
      setLoading(false);
      setResult(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      setResult(await generationsApi.history(filters));
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "History could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  function applyFilters(nextValue: HistoryFilterFormValue) {
    setFormValue(nextValue);
    const errors = validateHistoryFilters(nextValue);
    setFilterErrors(errors);
    if (Object.keys(errors).length) return;
    const next = searchParamsFromForm(nextValue);
    next.set("tab", "history");
    setSearchParams(next);
  }

  function resetFilters() {
    setFilterErrors({});
    setFormValue(
      formValueFromFilters({ page: 1, pageSize: 25, sortDirection: "desc" }),
    );
    setSearchParams(new URLSearchParams({ tab: "history" }));
  }

  async function downloadArtifact(id: string) {
    setDownloadId(id);
    setDownloadError(null);
    try {
      await generationsApi.downloadArtifact(id);
    } catch (cause) {
      setDownloadError(
        cause instanceof ApiError
          ? cause.message
          : "The artifact could not be downloaded.",
      );
    } finally {
      setDownloadId(null);
    }
  }

  return (
    <DashboardSection
      action={
        <RouterButton
          variant="secondary"
          to={`/design-systems/${designSystemId}/history/report${queryKey ? `?${queryKey}` : ""}`}
        >
          View report
        </RouterButton>
      }
    >
      <HistoryFilterForm
        value={formValue}
        errors={filterErrors}
        onApply={applyFilters}
        onReset={resetFilters}
      />

      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-text-secondary">
            Operational history
          </p>
          <h2 className="mt-1.5 text-xl font-medium tracking-refined">
            {result
              ? `${result.pagination.totalItems.toLocaleString()} matching runs`
              : "Matching runs"}
          </h2>
        </div>
      </div>
      {downloadError ? (
        <ErrorState
          title="Artifact download failed"
          description={downloadError}
        />
      ) : null}

      {loading ? <LoadingState label="Loading history…" /> : null}

      {!loading && error ? (
        <ErrorState
          title="We couldn't load history"
          description={error}
          onRetry={loadHistory}
          retryLabel="Try again"
        />
      ) : null}

      {!loading && !error && result?.items.length === 0 ? (
        <Empty
          title="No generation runs found"
          description={
            queryKey
              ? "No runs match these filters. Reset them to see all runs."
              : "Start a generation and its progress, metrics, and artifact will appear here."
          }
          action={
            queryKey ? (
              <Button variant="secondary" type="button" onClick={resetFilters}>
                Reset filters
              </Button>
            ) : (
              <RouterButton
                to={`/design-systems/${designSystemId}?tab=generate`}
              >
                Generate package
              </RouterButton>
            )
          }
        />
      ) : null}

      {!loading && !error && result && result.items.length > 0 ? (
        <>
          <DataTable
            caption="Generation history"
            data={result.items}
            getRowKey={(item) => item.id}
            columns={[
              {
                key: "packageVersion",
                header: "Version",
                sortable: false,
                cell: (item) => (
                  <div>
                    <p className="font-medium tabular-nums">
                      v{item.packageVersion}
                    </p>
                    <p className="font-secondary mt-0.5 text-[11px] text-text-secondary">
                      {item.packageName}
                    </p>
                  </div>
                ),
              },
              {
                key: "status",
                header: "Status",
                sortable: false,
                cell: (item) => <StatusBadge status={item.status} />,
              },
              {
                key: "startedAt",
                header: "Started",
                sortable: false,
                cell: (item) => (
                  <time
                    className="font-secondary text-xs text-text-secondary"
                    dateTime={item.startedAt || item.createdAt}
                  >
                    {formatTimestamp(item.startedAt || item.createdAt)}
                  </time>
                ),
              },
              {
                key: "duration",
                header: "Duration",
                sortable: false,
                className: "tabular-nums",
                cell: (item) =>
                  formatDuration(item.startedAt, item.completedAt),
              },
              {
                key: "metrics",
                header: "Metrics",
                sortable: false,
                cell: (item) => (
                  <div className="tabular-nums">
                    <p>
                      {item.componentCount} components · {item.tokenCount} tokens
                    </p>
                    <p className="font-secondary mt-0.5 text-[11px] text-text-secondary">
                      {item.warningCount} warnings · {item.errorCount} errors
                    </p>
                  </div>
                ),
              },
              {
                key: "actions",
                header: "Actions",
                align: "right",
                sortable: false,
                cell: (item) => (
                  <div className="flex justify-end gap-2">
                    {item.artifactAvailable ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        type="button"
                        onClick={downloadId ? undefined : () => downloadArtifact(item.id)}
                        loading={downloadId === item.id}
                        disabled={Boolean(downloadId && downloadId !== item.id)}
                      >
                        Download
                      </Button>
                    ) : null}
                    <RouterButton
                      variant="primary"
                      size="sm"
                      to={`/generations/${item.id}`}
                    >
                      View run
                    </RouterButton>
                  </div>
                ),
              },
            ]}
          />
          <PaginationControls
            pagination={result.pagination}
            onPage={(page) => setSearchParams(withPage(searchParams, page))}
          />
        </>
      ) : null}
    </DashboardSection>
  );
}

function formatDuration(startedAt: string | null, completedAt: string | null) {
  if (!startedAt || !completedAt) return "In progress";
  const milliseconds =
    new Date(completedAt).getTime() - new Date(startedAt).getTime();
  if (milliseconds < 1_000) return "< 1 sec";
  const seconds = Math.round(milliseconds / 1_000);
  if (seconds < 60) return `${seconds} sec`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return remainingSeconds
    ? `${minutes} min ${remainingSeconds} sec`
    : `${minutes} min`;
}

function StatusBadge({ status }: { status: GenerationStatus }) {
  return (
    <BleeckerStatusBadge
      variant={
        status === "succeeded"
          ? "live"
          : status === "failed"
            ? "offline"
            : "info"
      }
      label={statusLabel(status)}
    />
  );
}
