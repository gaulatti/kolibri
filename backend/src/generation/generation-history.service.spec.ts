import { BadRequestException } from '@nestjs/common';
import type { Repository, SelectQueryBuilder } from 'typeorm';
import type { AuthenticatedUser } from '../auth/authenticated-user';
import {
  DesignSystem,
  GenerationRun,
  GenerationRunStatus,
} from '../persistence/entities';
import {
  GenerationHistoryQueryDto,
  HistorySortDirection,
} from './dto/generation-history-query.dto';
import { GenerationHistoryService } from './generation-history.service';

const owner: AuthenticatedUser = {
  userReferenceId: 'fd803cd2-fb10-4d16-85ed-d93eb25a8e4f',
  cognitoSub: 'owner-cognito-sub',
};
const designSystemId = 'c1994330-51c5-4104-a54a-c90d940e03b3';

function run(id: string, createdAt: string): GenerationRun {
  const designSystem = {
    id: designSystemId,
    ownerId: owner.userReferenceId,
    name: 'Kolibri UI',
    description: 'Shared application components',
    owner: undefined as never,
    generationRuns: [],
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-01T00:00:00.000Z'),
  } satisfies DesignSystem;
  return {
    id,
    designSystemId,
    designSystem,
    status: GenerationRunStatus.SUCCEEDED,
    startedAt: new Date(createdAt),
    completedAt: new Date(createdAt),
    packageName: '@kolibri/ui',
    packageVersion: '1.0.0',
    artifactCount: 4,
    tokenCount: 3,
    componentCount: 2,
    warningCount: 1,
    errorCount: 0,
    artifactReference: '/internal/path/must-not-be-returned.zip',
    failureSummary: null,
    createdAt: new Date(createdAt),
    updatedAt: new Date(createdAt),
    events: [],
  };
}

function filters(
  overrides: Partial<GenerationHistoryQueryDto> = {},
): GenerationHistoryQueryDto {
  return Object.assign(new GenerationHistoryQueryDto(), overrides);
}

describe('GenerationHistoryService', () => {
  const innerJoinAndSelect = jest.fn();
  const select = jest.fn();
  const where = jest.fn();
  const andWhere = jest.fn();
  const orderBy = jest.fn();
  const addOrderBy = jest.fn();
  const skip = jest.fn();
  const take = jest.fn();
  const getManyAndCount = jest.fn();
  const createQueryBuilder = jest.fn();
  let service: GenerationHistoryService;

  beforeEach(() => {
    jest.clearAllMocks();
    const builder = {
      innerJoinAndSelect,
      select,
      where,
      andWhere,
      orderBy,
      addOrderBy,
      skip,
      take,
      getManyAndCount,
    } as unknown as SelectQueryBuilder<GenerationRun>;
    for (const method of [
      innerJoinAndSelect,
      select,
      where,
      andWhere,
      orderBy,
      addOrderBy,
      skip,
      take,
    ]) {
      method.mockReturnValue(builder);
    }
    createQueryBuilder.mockReturnValue(builder);
    service = new GenerationHistoryService({
      createQueryBuilder,
    } as unknown as Repository<GenerationRun>);
  });

  it('returns multiple owner-scoped rows with deterministic defaults', async () => {
    getManyAndCount.mockResolvedValue([
      [
        run('f515082d-5e8b-4309-a52e-1ec6cc4c4627', '2026-08-03T12:00:00Z'),
        run('130b2cc9-a5dc-4643-94d4-86a6f556b560', '2026-08-02T12:00:00Z'),
      ],
      2,
    ]);

    const result = await service.search(owner, filters());

    expect(result.items).toHaveLength(2);
    expect(result.pagination).toEqual({
      page: 1,
      pageSize: 25,
      totalItems: 2,
      totalPages: 1,
      hasPreviousPage: false,
      hasNextPage: false,
    });
    expect(where).toHaveBeenCalledWith('designSystem.ownerId = :ownerId', {
      ownerId: owner.userReferenceId,
    });
    expect(orderBy).toHaveBeenCalledWith('run.createdAt', 'DESC');
    expect(addOrderBy).toHaveBeenCalledWith('run.id', 'DESC');
    expect(skip).toHaveBeenCalledWith(0);
    expect(take).toHaveBeenCalledWith(25);
    expect(result.items[0]).toMatchObject({
      designSystemName: 'Kolibri UI',
      packageName: '@kolibri/ui',
    });
    expect(result.items[0]).not.toHaveProperty('artifactReference');
    expect(JSON.stringify(result)).not.toContain('must-never-be-returned');
    expect(JSON.stringify(result)).not.toContain('/internal/path');
  });

  it('applies parameterized filters, pagination, and ascending sorting', async () => {
    getManyAndCount.mockResolvedValue([
      [run('f515082d-5e8b-4309-a52e-1ec6cc4c4627', '2026-08-02T12:00:00Z')],
      3,
    ]);
    const result = await service.search(
      owner,
      filters({
        designSystemId,
        text: 'Kolibri',
        status: GenerationRunStatus.SUCCEEDED,
        startDate: '2026-08-01',
        endDate: '2026-08-31',
        page: 2,
        pageSize: 1,
        sortDirection: HistorySortDirection.ASC,
      }),
    );

    expect(andWhere).toHaveBeenCalledWith(
      'run.designSystemId = :designSystemId',
      { designSystemId },
    );
    expect(andWhere).toHaveBeenCalledWith(
      '(designSystem.name ILIKE :historyText OR run.packageName ILIKE :historyText)',
      { historyText: '%Kolibri%' },
    );
    expect(andWhere).toHaveBeenCalledWith('run.status = :status', {
      status: GenerationRunStatus.SUCCEEDED,
    });
    expect(andWhere).toHaveBeenCalledWith('run.createdAt >= :startDate', {
      startDate: new Date('2026-08-01T00:00:00.000Z'),
    });
    expect(andWhere).toHaveBeenCalledWith('run.createdAt <= :endDate', {
      endDate: new Date('2026-08-31T23:59:59.999Z'),
    });
    expect(orderBy).toHaveBeenCalledWith('run.createdAt', 'ASC');
    expect(addOrderBy).toHaveBeenCalledWith('run.id', 'ASC');
    expect(skip).toHaveBeenCalledWith(1);
    expect(take).toHaveBeenCalledWith(1);
    expect(result.pagination).toEqual({
      page: 2,
      pageSize: 1,
      totalItems: 3,
      totalPages: 3,
      hasPreviousPage: true,
      hasNextPage: true,
    });
  });

  it('returns an empty page with pagination metadata', async () => {
    getManyAndCount.mockResolvedValue([[], 0]);
    await expect(service.search(owner, filters())).resolves.toEqual({
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
  });

  it('rejects an inverted date range before querying PostgreSQL', async () => {
    await expect(
      service.search(
        owner,
        filters({ startDate: '2026-08-10', endDate: '2026-08-01' }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(createQueryBuilder).not.toHaveBeenCalled();
  });

  it('accepts full ISO timestamp filters without applying day boundaries', async () => {
    getManyAndCount.mockResolvedValue([[], 0]);
    await service.search(
      owner,
      filters({
        startDate: '2026-08-01T12:30:00.000Z',
        endDate: '2026-08-02T13:30:00.000Z',
      }),
    );
    expect(andWhere).toHaveBeenCalledWith('run.createdAt >= :startDate', {
      startDate: new Date('2026-08-01T12:30:00.000Z'),
    });
    expect(andWhere).toHaveBeenCalledWith('run.createdAt <= :endDate', {
      endDate: new Date('2026-08-02T13:30:00.000Z'),
    });
  });
});
