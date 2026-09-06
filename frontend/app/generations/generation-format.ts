import type { GenerationPhase, GenerationStatus } from "../api/generations";

export const TERMINAL_STATUSES: GenerationStatus[] = ["succeeded", "failed"];

export function statusLabel(status: GenerationStatus) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function phaseLabel(
  phase: GenerationPhase | null,
  status: GenerationStatus,
) {
  if (!phase) return status === "pending" ? "Queued" : statusLabel(status);
  const labels: Record<GenerationPhase, string> = {
    queued: "Queued",
    retrieving_source: "Retrieving source",
    normalizing: "Normalizing",
    generating: "Generating package",
    storing: "Storing artifacts",
    resolving_version: "Resolving npm version",
    publishing: "Publishing to npm",
    publication_failed: "npm publication failed",
    diagnostic_warning: "Warning",
    diagnostic_error: "Error",
    completed: "Completed",
    failed: "Failed",
  };
  return labels[phase];
}

export function formatTimestamp(value: string | null) {
  if (!value) return "Not yet";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(new Date(value));
}
