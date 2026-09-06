import { apiError, apiRequest, authenticatedFetch } from "./api-client";

export type GenerationStatus = "pending" | "running" | "succeeded" | "failed";

export type GenerationPhase =
  | "queued"
  | "retrieving_source"
  | "normalizing"
  | "generating"
  | "storing"
  | "resolving_version"
  | "publishing"
  | "publication_failed"
  | "diagnostic_warning"
  | "diagnostic_error"
  | "completed"
  | "failed";

export type GenerationRun = {
  id: string;
  designSystemId: string;
  status: GenerationStatus;
  startedAt: string | null;
  completedAt: string | null;
  artifactCount: number;
  tokenCount: number;
  componentCount: number;
  warningCount: number;
  errorCount: number;
  packageName: string;
  packageVersion: string;
  generationContract: "legacy" | "composable-v1";
  publishRequested: boolean;
  publishedAt: string | null;
  publicationFailureSummary: string | null;
  artifactAvailable: boolean;
  failureSummary: string | null;
  createdAt: string;
  updatedAt: string;
};

type GenerationRunResponse = Omit<GenerationRun, "artifactAvailable"> & {
  artifactReference: string | null;
};

type PresignedArtifactResponse = {
  kind: "presigned";
  downloadUrl: string;
  expiresInSeconds: number;
};

export type GenerationEvent = {
  id: string;
  eventType: GenerationPhase;
  message: string;
  createdAt: string;
};

export type GenerationHistoryFilters = {
  designSystemId?: string;
  text?: string;
  status?: GenerationStatus;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
  sortDirection?: "asc" | "desc";
};

export type GenerationHistoryItem = {
  id: string;
  designSystemId: string;
  designSystemName: string;
  packageName: string;
  packageVersion: string;
  status: GenerationStatus;
  startedAt: string | null;
  completedAt: string | null;
  artifactCount: number;
  artifactAvailable: boolean;
  tokenCount: number;
  componentCount: number;
  warningCount: number;
  errorCount: number;
  failureSummary: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Pagination = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};

export type GenerationHistoryResult = {
  items: GenerationHistoryItem[];
  pagination: Pagination;
};

export const generationsApi = {
  start: (designSystemId: string, publishToNpm = false) =>
    apiRequest<{ runId: string; status: "pending" }>("/v1/generations", {
      method: "POST",
      body: JSON.stringify({ designSystemId, publishToNpm }),
    }),

  history: (filters: GenerationHistoryFilters) =>
    apiRequest<GenerationHistoryResult>(
      `/v1/generations?${historyQuery(filters)}`,
    ),

  async get(id: string): Promise<GenerationRun> {
    const response = await apiRequest<GenerationRunResponse>(
      `/v1/generations/${encodeURIComponent(id)}`,
    );
    const { artifactReference, ...run } = response;
    return { ...run, artifactAvailable: Boolean(artifactReference) };
  },

  async streamEvents(
    id: string,
    signal: AbortSignal,
    onEvent: (event: GenerationEvent) => void,
  ): Promise<void> {
    const response = await authenticatedFetch(
      `/v1/generations/${encodeURIComponent(id)}/events`,
      { signal, headers: { Accept: "text/event-stream" } },
    );
    if (!response.ok) throw await apiError(response);
    if (!response.body)
      throw new Error("Progress streaming is unavailable in this browser.");
    await consumeEventStream(response.body, onEvent, signal);
  },

  async downloadArtifact(id: string): Promise<void> {
    const response = await authenticatedFetch(
      `/v1/generations/${encodeURIComponent(id)}/artifact`,
      { headers: { Accept: "application/json, application/zip" } },
    );
    if (!response.ok) throw await apiError(response);

    if (response.headers.get("Content-Type")?.includes("application/json")) {
      const access = (await response.json()) as unknown;
      if (!isPresignedArtifactResponse(access)) {
        throw new Error("The artifact download response is invalid.");
      }
      startBrowserDownload(access.downloadUrl);
      return;
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    startBrowserDownload(
      objectUrl,
      downloadFilename(response.headers.get("Content-Disposition"), id),
    );
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);
  },
};

function isPresignedArtifactResponse(
  value: unknown,
): value is PresignedArtifactResponse {
  if (!value || typeof value !== "object") return false;
  const access = value as Partial<PresignedArtifactResponse>;
  if (
    access.kind !== "presigned" ||
    typeof access.downloadUrl !== "string" ||
    !Number.isInteger(access.expiresInSeconds) ||
    Number(access.expiresInSeconds) < 60 ||
    Number(access.expiresInSeconds) > 900
  ) {
    return false;
  }
  try {
    return new URL(access.downloadUrl).protocol === "https:";
  } catch {
    return false;
  }
}

function startBrowserDownload(url: string, filename?: string) {
  const anchor = document.createElement("a");
  anchor.href = url;
  if (filename) anchor.download = filename;
  anchor.rel = "noopener";
  anchor.style.display = "none";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}

export function historyQuery(filters: GenerationHistoryFilters): string {
  const query = new URLSearchParams();
  if (filters.designSystemId)
    query.set("designSystemId", filters.designSystemId);
  if (filters.text) query.set("text", filters.text);
  if (filters.status) query.set("status", filters.status);
  if (filters.startDate) query.set("startDate", filters.startDate);
  if (filters.endDate) query.set("endDate", filters.endDate);
  query.set("page", String(filters.page || 1));
  query.set("pageSize", String(filters.pageSize || 25));
  query.set("sortDirection", filters.sortDirection || "desc");
  return query.toString();
}

async function consumeEventStream(
  stream: ReadableStream<Uint8Array>,
  onEvent: (event: GenerationEvent) => void,
  signal: AbortSignal,
) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (!signal.aborted) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const records = buffer.split(/\r?\n\r?\n/);
      buffer = records.pop() ?? "";
      for (const record of records) emitRecord(record, onEvent);
      if (done) {
        if (buffer.trim()) emitRecord(buffer, onEvent);
        return;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function emitRecord(record: string, onEvent: (event: GenerationEvent) => void) {
  const data = record
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart())
    .join("\n");
  if (!data) return;

  try {
    const event = JSON.parse(data) as unknown;
    if (isGenerationEvent(event)) onEvent(event);
  } catch {
    // A malformed event is ignored; status recovery remains available.
  }
}

function isGenerationEvent(value: unknown): value is GenerationEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Partial<GenerationEvent>;
  const phases: GenerationPhase[] = [
    "queued",
    "retrieving_source",
    "normalizing",
    "generating",
    "storing",
    "resolving_version",
    "publishing",
    "publication_failed",
    "diagnostic_warning",
    "diagnostic_error",
    "completed",
    "failed",
  ];
  return (
    typeof event.id === "string" &&
    typeof event.eventType === "string" &&
    phases.includes(event.eventType as GenerationPhase) &&
    typeof event.message === "string" &&
    typeof event.createdAt === "string"
  );
}

function downloadFilename(contentDisposition: string | null, id: string) {
  const match = contentDisposition?.match(/filename="?([^";]+)"?/i);
  const filename = match?.[1]?.trim();
  return filename && /^[A-Za-z0-9._-]+$/.test(filename)
    ? filename
    : `kolibri-generation-${id}.zip`;
}
