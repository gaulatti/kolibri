import type { GenerationRunStatus } from '../persistence/entities';

export const GENERATION_PHASES = {
  QUEUED: 'queued',
  RETRIEVING_SOURCE: 'retrieving_source',
  NORMALIZING: 'normalizing',
  GENERATING: 'generating',
  STORING: 'storing',
  RESOLVING_VERSION: 'resolving_version',
  PUBLISHING: 'publishing',
  PUBLICATION_FAILED: 'publication_failed',
  DIAGNOSTIC_WARNING: 'diagnostic_warning',
  DIAGNOSTIC_ERROR: 'diagnostic_error',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

export type GenerationPhase =
  (typeof GENERATION_PHASES)[keyof typeof GENERATION_PHASES];

export type GenerationQueuedView = {
  runId: string;
  status: GenerationRunStatus.PENDING;
};

export type GenerationRunView = {
  id: string;
  designSystemId: string;
  status: GenerationRunStatus;
  startedAt: Date | null;
  completedAt: Date | null;
  artifactCount: number;
  tokenCount: number;
  componentCount: number;
  warningCount: number;
  errorCount: number;
  packageName: string;
  packageVersion: string;
  generationContract: 'legacy' | 'composable-v1';
  publishRequested: boolean;
  publishedAt: Date | null;
  publicationFailureSummary: string | null;
  artifactReference: string | null;
  failureSummary: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type GenerationEventView = {
  id: string;
  eventType: string;
  message: string;
  createdAt: Date;
};
