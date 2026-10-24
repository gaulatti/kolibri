import type { GenerationRunStatus } from '../persistence/entities';

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

export type DashboardVolumePoint = {
  date: string;
  counts: Array<{ designSystemId: string; count: number }>;
};

export type DashboardPerformancePoint = {
  date: string;
  medianDurationMs: number | null;
  p95DurationMs: number | null;
};

export type DashboardEfficiencyPoint = {
  runId: string;
  designSystemId: string;
  designSystemName: string;
  packageVersion: string;
  componentCount: number;
  artifactCount: number;
  durationMs: number;
  publishRequested: boolean;
};

export type DesignSystemHealth = {
  id: string;
  name: string;
  health: 'healthy' | 'attention' | 'unproven';
  attentionReason: string | null;
  latestStatus: GenerationRunStatus | null;
  latestRunAt: Date | null;
  lastSuccessfulAt: Date | null;
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
  designSystems: DesignSystemHealth[];
  generationVolume: DashboardVolumePoint[];
  performance: DashboardPerformancePoint[];
  generationEfficiency: DashboardEfficiencyPoint[];
};
