import { apiRequest } from "./api-client";
import {
  historyQuery,
  type GenerationHistoryFilters,
  type GenerationStatus,
  type Pagination,
} from "./generations";

export type GenerationHistoryReportRow = {
  designSystem: string;
  packageName: string;
  packageVersion: string;
  status: GenerationStatus;
  startedAt: string | null;
  completedAt: string | null;
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
  title: "Generation History Report";
  generatedAt: string;
  appliedFilters: {
    designSystemId: string | null;
    text: string | null;
    status: GenerationStatus | null;
    startDate: string | null;
    endDate: string | null;
    sortDirection: "asc" | "desc";
    page: number;
    pageSize: number;
  };
  columns: GenerationHistoryReportColumn[];
  pagination: Pagination;
  rows: GenerationHistoryReportRow[];
};

export const reportsApi = {
  generationHistory: (filters: GenerationHistoryFilters) =>
    apiRequest<GenerationHistoryReport>(
      `/v1/reports/generation-history?${historyQuery(filters)}`,
    ),
};
