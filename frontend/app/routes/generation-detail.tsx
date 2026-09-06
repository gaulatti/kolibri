import {
  Button,
  Card,
  DashboardGrid,
  DashboardSection,
  DataList,
  Empty,
  ErrorState,
  LoadingSpinner,
  PageHeader,
  Progress,
  StatCard,
  StatusBadge,
  Tabs,
  Timeline,
} from "~/bleecker";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { ApiError } from "../api/api-client";
import { designSystemsApi, type DesignSystem } from "../api/design-systems";
import {
  generationsApi,
  type GenerationEvent,
  type GenerationRun,
} from "../api/generations";
import { LoadingState } from "../components/loading-state";
import { AppBreadcrumb } from "../components/app-breadcrumb";
import { RouterButton } from "../components/router-button";
import {
  formatTimestamp,
  phaseLabel,
  statusLabel,
  TERMINAL_STATUSES,
} from "../generations/generation-format";
import type { Route } from "./+types/generation-detail";

type ConnectionState = "connecting" | "live" | "reconnecting" | "complete";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Generation progress | kolibri" }];
}

export default function GenerationDetail({ params }: Route.ComponentProps) {
  const [run, setRun] = useState<GenerationRun | null>(null);
  const [designSystem, setDesignSystem] = useState<DesignSystem | null>(null);
  const [events, setEvents] = useState<GenerationEvent[]>([]);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [streamNotice, setStreamNotice] = useState<string | null>(null);
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [downloadPending, setDownloadPending] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = generationTab(searchParams.get("tab"));

  useEffect(() => {
    let active = true;
    let streamController: AbortController | null = null;
    let terminalEventObserved = false;
    const seenEventIds = new Set<string>();

    function acceptRun(current: GenerationRun) {
      if (!active) return;
      setRun((previous) =>
        previous &&
        TERMINAL_STATUSES.includes(previous.status) &&
        !TERMINAL_STATUSES.includes(current.status)
          ? previous
          : current,
      );
    }

    function acceptEvent(event: GenerationEvent) {
      if (!active || seenEventIds.has(event.id)) return;
      seenEventIds.add(event.id);
      if (event.eventType === "completed" || event.eventType === "failed") {
        terminalEventObserved = true;
      }
      setEvents((current) => [...current, event]);
      if (
        event.eventType !== "queued" &&
        !event.eventType.startsWith("diagnostic_")
      ) {
        void generationsApi
          .get(params.generationId)
          .then((current) => {
            acceptRun(current);
          })
          .catch(() => {
            // The reconnect loop remains the source of truth after transient failures.
          });
      }
    }

    async function loadDesignSystem(designSystemId: string) {
      try {
        const result = await designSystemsApi.get(designSystemId);
        if (active) setDesignSystem(result);
      } catch {
        // Run progress remains usable if supplementary design-system details fail.
      }
    }

    async function recover() {
      let firstRequest = true;
      let reconnectDelay = 1_000;

      while (active) {
        try {
          const current = await generationsApi.get(params.generationId);
          if (!active) return;
          acceptRun(current);
          setLoadingError(null);
          if (firstRequest) void loadDesignSystem(current.designSystemId);
          firstRequest = false;

          if (TERMINAL_STATUSES.includes(current.status)) {
            setConnection("complete");
            setStreamNotice(null);
            streamController = new AbortController();
            try {
              await generationsApi.streamEvents(
                params.generationId,
                streamController.signal,
                acceptEvent,
              );
            } catch (cause) {
              if (!(
                cause instanceof DOMException && cause.name === "AbortError"
              )) {
                setStreamNotice(
                  "Final status recovered. The saved event timeline is unavailable.",
                );
              }
            }
            return;
          }

          setConnection(
            reconnectDelay === 1_000 ? "connecting" : "reconnecting",
          );
          setStreamNotice(null);
          streamController = new AbortController();
          setConnection("live");
          await generationsApi.streamEvents(
            params.generationId,
            streamController.signal,
            acceptEvent,
          );
          if (!active) return;
          if (terminalEventObserved) continue;
          setConnection("reconnecting");
          setStreamNotice(
            "Live progress was interrupted. Recovering from saved status…",
          );
          await wait(reconnectDelay);
          reconnectDelay = Math.min(reconnectDelay * 2, 5_000);
        } catch (cause) {
          if (
            !active ||
            (cause instanceof DOMException && cause.name === "AbortError")
          )
            return;
          if (firstRequest) {
            setLoadingError(
              cause instanceof ApiError
                ? cause.message
                : "This generation run could not be loaded.",
            );
            return;
          }
          setConnection("reconnecting");
          setStreamNotice(
            "Live progress was interrupted. Recovering from saved status…",
          );
          await wait(reconnectDelay);
          reconnectDelay = Math.min(reconnectDelay * 2, 5_000);
        }
      }
    }

    void recover();
    return () => {
      active = false;
      streamController?.abort();
    };
  }, [params.generationId]);

  const diagnosticEvents = useMemo(
    () => events.filter((event) => event.eventType.startsWith("diagnostic_")),
    [events],
  );
  const progressEvents = useMemo(
    () => events.filter((event) => !event.eventType.startsWith("diagnostic_")),
    [events],
  );
  const terminal = run ? TERMINAL_STATUSES.includes(run.status) : false;
  const canDownload = Boolean(
    run?.status === "succeeded" && run.artifactAvailable && !downloadPending,
  );

  async function downloadArtifact() {
    if (!canDownload) return;
    setDownloadPending(true);
    setDownloadError(null);
    try {
      await generationsApi.downloadArtifact(params.generationId);
    } catch (cause) {
      setDownloadError(
        cause instanceof ApiError
          ? cause.message
          : "The artifact could not be downloaded. Please try again.",
      );
    } finally {
      setDownloadPending(false);
    }
  }

  if (loadingError) {
    return (
      <DashboardSection>
        <AppBreadcrumb
          items={[
            { href: "/", label: "Home" },
            { href: "/design-systems", label: "Design Systems" },
            {
              href: `/generations/${params.generationId}`,
              label: "Generation",
            },
          ]}
        />
        <ErrorState title="Generation unavailable" description={loadingError} />
        <RouterButton variant="secondary" to="/design-systems">
          Design Systems
        </RouterButton>
      </DashboardSection>
    );
  }

  if (!run)
    return (
      <DashboardSection>
        <AppBreadcrumb
          items={[
            { href: "/", label: "Home" },
            { href: "/design-systems", label: "Design Systems" },
            {
              href: `/generations/${params.generationId}`,
              label: "Generation",
            },
          ]}
        />
        <LoadingState label="Recovering generation status…" />
      </DashboardSection>
    );

  return (
    <DashboardSection className="space-y-10">
      <PageHeader
        className="border-b border-sand/25 pb-8 dark:border-white/[0.08]"
        title={designSystem?.name || "Generation"}
        description={`Run ID: ${run.id}`}
        breadcrumbs={
          <AppBreadcrumb
            items={[
              { href: "/", label: "Home" },
              { href: "/design-systems", label: "Design Systems" },
              {
                href: `/design-systems/${run.designSystemId}`,
                label: designSystem?.name || "Design system",
              },
              {
                href: `/generations/${run.id}`,
                label: "Generation",
              },
            ]}
          />
        }
        actions={
          <StatusBadge
            variant={
              run.status === "succeeded"
                ? "live"
                : run.status === "failed"
                  ? "offline"
                  : "info"
            }
            label={statusLabel(run.status)}
          />
        }
      />

      <Tabs
        aria-label="Generation run details"
        className="overflow-x-auto"
        activeTab={activeTab}
        onChange={(tab) => {
          const next = new URLSearchParams(searchParams);
          if (tab === "summary") next.delete("tab");
          else next.set("tab", tab);
          setSearchParams(next, { replace: true });
        }}
        tabs={[
          { id: "summary", label: "Summary", panelId: "summary-panel" },
          {
            id: "diagnostics",
            label: `Diagnostics (${run.warningCount + run.errorCount})`,
            panelId: "diagnostics-panel",
          },
        ]}
      />

      {activeTab === "summary" ? (
        <div id="summary-panel" role="tabpanel">
        <DashboardSection className="space-y-10 pt-4">
          {streamNotice ? (
            <Card variant="subtle" padding="sm" role="status">
              <div className="flex items-center gap-3">
                <StatusBadge variant="warning" label="Reconnecting" />
                <p className="font-secondary text-sm text-text-secondary">
                  {streamNotice}
                </p>
              </div>
            </Card>
          ) : null}

          {run.status === "failed" ? (
            <>
              <ErrorState
                title="Generation didn't complete"
                description={
                  run.failureSummary ||
                  "Generation failed. Check the design-system configuration and try again."
                }
              />
              <RouterButton
                variant="secondary"
                to={`/design-systems/${run.designSystemId}?tab=generate`}
              >
                Try another run
              </RouterButton>
            </>
          ) : null}

          {run.publicationFailureSummary ? (
            <ErrorState
              title="npm publication did not complete"
              description={run.publicationFailureSummary}
            />
          ) : null}

          <Card
            variant="subtle"
            aria-live="polite"
            aria-atomic="true"
          >
            <Progress
              value={
                terminal
                  ? 100
                  : Math.min(90, Math.max(10, progressEvents.length * 16))
              }
              variant={run.status === "failed" ? "destructive" : "success"}
              showLabel
            />
          </Card>

          <DashboardSection title="Run metrics">
            <DashboardGrid columns={5}>
              <StatCard title="Components" value={run.componentCount} />
              <StatCard title="Tokens" value={run.tokenCount} />
              <StatCard title="Artifacts" value={run.artifactCount} />
              <StatCard title="Warnings" value={run.warningCount} />
              <StatCard title="Errors" value={run.errorCount} />
            </DashboardGrid>
          </DashboardSection>

          <DashboardGrid columns={2}>
            <Card variant="outlined" padding="lg">
              <DashboardSection title="Progress">
                {progressEvents.length ? (
                  <Timeline
                    items={progressEvents.map((event, index) => ({
                      id: event.id,
                      title: phaseLabel(event.eventType, run.status),
                      timestamp: formatTimestamp(event.createdAt),
                      status:
                        event.eventType === "failed"
                          ? "error"
                          : index === progressEvents.length - 1 && !terminal
                            ? "active"
                            : "completed",
                    }))}
                  />
                ) : (
                  <LoadingSpinner className="min-h-32" size="md" />
                )}
              </DashboardSection>
            </Card>

            <DashboardSection>
              <Card variant="outlined">
                <DashboardSection title="Timing">
                  <DataList
                    items={[
                      {
                        id: "queued",
                        label: "Started",
                        value: formatTimestamp(run.startedAt),
                      },
                      {
                        id: "duration",
                        label: "Duration",
                        value: formatRunDuration(
                          run.startedAt,
                          run.completedAt,
                        ),
                      },
                    ]}
                  />
                </DashboardSection>
              </Card>
              <Card variant="outlined">
                <DashboardSection title="Package">
                  <DataList
                    items={[
                      { id: "name", label: "Package", value: run.packageName },
                      {
                        id: "version",
                        label: "Version",
                        value: run.packageVersion,
                      },
                      {
                        id: "publication",
                        label: "npm publication",
                        value: !run.publishRequested
                          ? "Not requested"
                          : run.publishedAt
                            ? `Published ${formatTimestamp(run.publishedAt)}`
                            : run.publicationFailureSummary
                              ? "Failed"
                              : "Pending",
                      },
                    ]}
                  />
                </DashboardSection>
              </Card>
              <Card variant="outlined">
                <DashboardSection title="Artifact">
                  {downloadError ? (
                    <ErrorState
                      title="Download failed"
                      description={downloadError}
                    />
                  ) : null}
                  {run.artifactAvailable ? (
                    <Button
                      type="button"
                      onClick={downloadArtifact}
                      loading={downloadPending}
                      disabled={!canDownload && !downloadPending}
                    >
                      Download package
                    </Button>
                  ) : (
                    <Empty title="No package artifact" />
                  )}
                </DashboardSection>
              </Card>
            </DashboardSection>
          </DashboardGrid>
        </DashboardSection>
        </div>
      ) : null}

      {activeTab === "diagnostics" ? (
        <Card
          id="diagnostics-panel"
          role="tabpanel"
          className="mt-4"
          variant="outlined"
          padding="lg"
        >
          <DashboardSection title="Diagnostics">
            {diagnosticEvents.length ? (
              <DataList
                items={diagnosticEvents.map((event) => ({
                  id: event.id,
                  label:
                    event.eventType === "diagnostic_error"
                      ? "Error"
                      : "Warning",
                  value: event.message,
                }))}
              />
            ) : connection === "complete" ? (
              <Empty title="No diagnostics" />
            ) : (
              <LoadingSpinner className="min-h-32" size="md" />
            )}
          </DashboardSection>
        </Card>
      ) : null}
    </DashboardSection>
  );
}

function generationTab(value: string | null) {
  return value === "diagnostics" ? "diagnostics" : "summary";
}

function wait(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function formatRunDuration(
  startedAt: string | null,
  completedAt: string | null,
) {
  if (!startedAt) return "Not started";
  if (!completedAt) return "In progress";
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
