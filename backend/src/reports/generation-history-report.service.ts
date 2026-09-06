import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/authenticated-user';
import {
  GenerationHistoryQueryDto,
  HistorySortDirection,
} from '../generation/dto/generation-history-query.dto';
import { GenerationHistoryService } from '../generation/generation-history.service';
import type {
  GenerationHistoryReport,
  GenerationHistoryReportColumn,
} from './generation-history-report.types';

const REPORT_COLUMNS: GenerationHistoryReportColumn[] = [
  { key: 'designSystem', label: 'Design system' },
  { key: 'packageName', label: 'Package name' },
  { key: 'packageVersion', label: 'Package version' },
  { key: 'status', label: 'Status' },
  { key: 'startedAt', label: 'Start time' },
  { key: 'completedAt', label: 'Completion time' },
  { key: 'componentCount', label: 'Components' },
  { key: 'tokenCount', label: 'Tokens' },
  { key: 'artifactCount', label: 'Artifacts' },
  { key: 'warningCount', label: 'Warnings' },
  { key: 'errorCount', label: 'Errors' },
  { key: 'artifactAvailable', label: 'Artifact available' },
];

@Injectable()
export class GenerationHistoryReportService {
  constructor(private readonly history: GenerationHistoryService) {}

  async generate(
    user: AuthenticatedUser,
    filters: GenerationHistoryQueryDto,
  ): Promise<GenerationHistoryReport> {
    const result = await this.history.search(user, filters);
    return {
      title: 'Generation History Report',
      generatedAt: new Date().toISOString(),
      appliedFilters: {
        designSystemId: filters.designSystemId ?? null,
        text: filters.text ?? null,
        status: filters.status ?? null,
        startDate: filters.startDate ?? null,
        endDate: filters.endDate ?? null,
        sortDirection: filters.sortDirection ?? HistorySortDirection.DESC,
        page: filters.page,
        pageSize: filters.pageSize,
      },
      columns: REPORT_COLUMNS.map((column) => ({ ...column })),
      pagination: result.pagination,
      rows: result.items.map((item) => ({
        designSystem: item.designSystemName,
        packageName: item.packageName,
        packageVersion: item.packageVersion,
        status: item.status,
        startedAt: item.startedAt,
        completedAt: item.completedAt,
        componentCount: item.componentCount,
        tokenCount: item.tokenCount,
        artifactCount: item.artifactCount,
        warningCount: item.warningCount,
        errorCount: item.errorCount,
        artifactAvailable: item.artifactAvailable,
      })),
    };
  }
}
