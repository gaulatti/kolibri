import type { GenerationRunStatus } from '../persistence/entities';
import type { HistorySortDirection } from '../generation/dto/generation-history-query.dto';

export type GenerationHistoryReportRow = {
  designSystem: string;
  packageName: string;
  packageVersion: string;
  status: GenerationRunStatus;
  startedAt: Date | null;
  completedAt: Date | null;
  componentCount: number;
  tokenCount: number;
  artifactCount: number;
  warningCount: number;
  errorCount: number;
  artifactAvailable: boolean;
};

export type GenerationHistoryReportColumn = {
  key: keyof GenerationHistoryReportRow;
  label: string;
};

export type GenerationHistoryReport = {
  title: 'Generation History Report';
  generatedAt: string;
  appliedFilters: {
    designSystemId: string | null;
    text: string | null;
    status: GenerationRunStatus | null;
    startDate: string | null;
    endDate: string | null;
    sortDirection: HistorySortDirection;
    page: number;
    pageSize: number;
  };
  columns: GenerationHistoryReportColumn[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
  };
  rows: GenerationHistoryReportRow[];
};
