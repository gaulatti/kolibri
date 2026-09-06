import type { GenerationStatus } from "./generations";
import { apiRequest } from "./api-client";

export type DashboardSummary = {
  totalDesignSystems: number;
  requiringAttention: number;
  generatedRuns: number;
  successRate: number | null;
  failedRuns: number;
  medianDurationMs: number | null;
  p95DurationMs: number | null;
  publicationSuccessRate: number | null;
};

export type DashboardDesignSystemHealth = {
  id: string;
  name: string;
  health: "healthy" | "attention" | "unproven";
  attentionReason: string | null;
  latestStatus: GenerationStatus | null;
  latestRunAt: string | null;
  lastSuccessfulAt: string | null;
  currentVersion: string | null;
  lastPublishedVersion: string | null;
  componentCount: number | null;
  componentDelta: number | null;
  warningCount: number | null;
  errorCount: number | null;
};

export type DashboardReport = {
  generatedAt: string;
  periodDays: number;
  summary: DashboardSummary;
  designSystems: DashboardDesignSystemHealth[];
  generationVolume: Array<{
    date: string;
    counts: Array<{ designSystemId: string; count: number }>;
  }>;
  performance: Array<{
    date: string;
    medianDurationMs: number | null;
    p95DurationMs: number | null;
  }>;
  generationEfficiency: Array<{
    runId: string;
    designSystemId: string;
    designSystemName: string;
    packageVersion: string;
    componentCount: number;
    artifactCount: number;
    durationMs: number;
    publishRequested: boolean;
  }>;
};

export const dashboardApi = {
  get: () => apiRequest<DashboardReport>("/v1/dashboard"),
};
