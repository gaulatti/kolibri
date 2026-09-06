import type { GenerationRunStatus } from '../persistence/entities';

export type GenerationHistoryItem = {
  id: string;
  designSystemId: string;
  designSystemName: string;
  packageName: string;
  packageVersion: string;
  status: GenerationRunStatus;
  startedAt: Date | null;
  completedAt: Date | null;
  artifactCount: number;
  artifactAvailable: boolean;
  tokenCount: number;
  componentCount: number;
  warningCount: number;
  errorCount: number;
  failureSummary: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type GenerationHistoryResult = {
  items: GenerationHistoryItem[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
  };
};
