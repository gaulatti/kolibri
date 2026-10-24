import type { AuthenticatedUser } from '../auth/authenticated-user';
import {
  GenerationHistoryQueryDto,
  HistorySortDirection,
} from '../generation/dto/generation-history-query.dto';
import type { GenerationHistoryService } from '../generation/generation-history.service';
import type { GenerationHistoryItem } from '../generation/generation-history.types';
import { GenerationRunStatus } from '../persistence/entities';
import { GenerationHistoryReportService } from './generation-history-report.service';

const owner: AuthenticatedUser = {
  userReferenceId: 'fd803cd2-fb10-4d16-85ed-d93eb25a8e4f',
  cognitoSub: 'owner-cognito-sub',
};

function item(
  id: string,
  overrides: Partial<GenerationHistoryItem> = {},
): GenerationHistoryItem {
  return {
    id,
    designSystemId: 'c1994330-51c5-4104-a54a-c90d940e03b3',
    designSystemName: 'Kolibri UI',
    packageName: '@kolibri/ui',
    packageVersion: '1.0.0',
    status: GenerationRunStatus.SUCCEEDED,
    startedAt: new Date('2026-08-01T12:00:00.000Z'),
    completedAt: new Date('2026-08-01T12:01:00.000Z'),
    artifactCount: 4,
    artifactAvailable: true,
    tokenCount: 3,
    componentCount: 2,
    warningCount: 1,
    errorCount: 0,
    failureSummary: null,
    createdAt: new Date('2026-08-01T11:59:00.000Z'),
    updatedAt: new Date('2026-08-01T12:01:00.000Z'),
    ...overrides,
  };
}

describe('GenerationHistoryReportService', () => {
  const search = jest.fn();
  const service = new GenerationHistoryReportService({
    search,
  } as unknown as GenerationHistoryService);

  beforeEach(() => {
    jest.clearAllMocks();
    search.mockResolvedValue({
      items: [
        item('f515082d-5e8b-4309-a52e-1ec6cc4c4627'),
        item('130b2cc9-a5dc-4643-94d4-86a6f556b560', {
          designSystemName: 'Second UI',
          packageName: '@kolibri/second-ui',
          status: GenerationRunStatus.FAILED,
          artifactCount: 0,
          artifactAvailable: false,
          errorCount: 1,
        }),
      ],
      pagination: {
        page: 1,
        pageSize: 25,
        totalItems: 2,
        totalPages: 1,
        hasPreviousPage: false,
        hasNextPage: false,
      },
    });
  });

  it('returns report title, backend timestamp, columns, and multiple rows', async () => {
    const before = Date.now();
    const report = await service.generate(
      owner,
      new GenerationHistoryQueryDto(),
    );
    const after = Date.now();

    expect(report.title).toBe('Generation History Report');
    expect(report.generatedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );
    expect(Date.parse(report.generatedAt)).toBeGreaterThanOrEqual(before);
    expect(Date.parse(report.generatedAt)).toBeLessThanOrEqual(after);
    expect(report.columns.map((column) => column.key)).toEqual([
      'designSystem',
      'packageName',
      'packageVersion',
      'status',
      'startedAt',
      'completedAt',
      'componentCount',
      'tokenCount',
      'artifactCount',
      'warningCount',
      'errorCount',
      'artifactAvailable',
    ]);
    expect(report.rows).toHaveLength(2);
    expect(report.rows[0]).toMatchObject({
      designSystem: 'Kolibri UI',
      packageName: '@kolibri/ui',
      packageVersion: '1.0.0',
      status: GenerationRunStatus.SUCCEEDED,
      componentCount: 2,
      tokenCount: 3,
      artifactCount: 4,
      warningCount: 1,
      errorCount: 0,
      artifactAvailable: true,
    });
    expect(report.rows[1]).toMatchObject({
      status: GenerationRunStatus.FAILED,
      artifactAvailable: false,
    });
  });

  it('reuses owner-scoped history filters and summarizes those applied', async () => {
    const filters = Object.assign(new GenerationHistoryQueryDto(), {
      designSystemId: 'c1994330-51c5-4104-a54a-c90d940e03b3',
      text: 'Kolibri',
      status: GenerationRunStatus.SUCCEEDED,
      startDate: '2026-08-01',
      endDate: '2026-08-31',
      sortDirection: HistorySortDirection.ASC,
      page: 2,
      pageSize: 10,
    });

    const report = await service.generate(owner, filters);

    expect(search).toHaveBeenCalledWith(owner, filters);
    expect(report.appliedFilters).toEqual({
      designSystemId: filters.designSystemId,
      text: 'Kolibri',
      status: GenerationRunStatus.SUCCEEDED,
      startDate: '2026-08-01',
      endDate: '2026-08-31',
      sortDirection: HistorySortDirection.ASC,
      page: 2,
      pageSize: 10,
    });
  });

  it('returns valid metadata and columns with an empty row array', async () => {
    search.mockResolvedValueOnce({
      items: [],
      pagination: {
        page: 1,
        pageSize: 25,
        totalItems: 0,
        totalPages: 0,
        hasPreviousPage: false,
        hasNextPage: false,
      },
    });

    const report = await service.generate(
      owner,
      new GenerationHistoryQueryDto(),
    );
    expect(report).toMatchObject({
      title: 'Generation History Report',
      pagination: { totalItems: 0, totalPages: 0 },
      rows: [],
    });
    expect(report.columns.length).toBeGreaterThan(1);
  });

  it('reports descending order for an omitted optional sort direction', async () => {
    const filters = new GenerationHistoryQueryDto();
    delete (filters as Partial<GenerationHistoryQueryDto>).sortDirection;
    const report = await service.generate(owner, filters);
    expect(report.appliedFilters.sortDirection).toBe(HistorySortDirection.DESC);
    expect(search).toHaveBeenCalledWith(owner, filters);
  });
});
