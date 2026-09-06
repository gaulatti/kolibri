import type { Repository, SelectQueryBuilder } from 'typeorm';
import type { AuthenticatedUser } from '../auth/authenticated-user';
import {
  DesignSystem,
  GenerationRun,
  GenerationRunStatus,
} from '../persistence/entities';
import { DashboardService } from './dashboard.service';

const owner: AuthenticatedUser = {
  userReferenceId: '1d878a57-58f9-4115-a129-cecddd3b9394',
  cognitoSub: 'owner-sub',
};
const firstId = '66454655-572d-497b-b42a-bb4b2b2f5118';
const secondId = '8394f5d6-6b65-41df-805b-f87ec8ccb2f3';

describe('DashboardService', () => {
  const findDesignSystems = jest.fn();
  const findRuns = jest.fn();
  const getMany = jest.fn();
  const createQueryBuilder = jest.fn();
  let service: DashboardService;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-03T12:00:00.000Z'));
    jest.clearAllMocks();
    const builder = chainableBuilder(getMany);
    createQueryBuilder.mockReturnValue(builder);
    findDesignSystems.mockResolvedValue([
      designSystem(firstId, 'Primary'),
      designSystem(secondId, 'Secondary'),
    ]);
    const successful = run({
      id: '9aaa7fc7-93c6-46b5-8758-43af6df9c71b',
      designSystemId: firstId,
      status: GenerationRunStatus.SUCCEEDED,
      createdAt: '2026-08-03T09:00:00.000Z',
      durationMs: 1_000,
      componentCount: 12,
      warningCount: 2,
      publishRequested: true,
      publishedAt: '2026-08-03T09:00:02.000Z',
    });
    const failed = run({
      id: 'cfac80c4-9093-4533-81f3-30da1854d82e',
      designSystemId: firstId,
      status: GenerationRunStatus.FAILED,
      createdAt: '2026-08-03T10:00:00.000Z',
      durationMs: 4_000,
      publishRequested: true,
    });
    const previous = run({
      id: '91b50a40-38d6-4b3a-a8f0-d582e9ca836f',
      designSystemId: firstId,
      status: GenerationRunStatus.SUCCEEDED,
      createdAt: '2026-07-30T09:00:00.000Z',
      durationMs: 2_000,
      componentCount: 10,
    });
    getMany.mockResolvedValue([successful, failed]);
    findRuns.mockImplementation(
      ({ where }: { where: Record<string, unknown> }) => {
        if (where.designSystemId === secondId) return Promise.resolve([]);
        if (where.status === GenerationRunStatus.SUCCEEDED) {
          return Promise.resolve([successful, previous]);
        }
        return Promise.resolve([failed]);
      },
    );
    service = new DashboardService(
      { find: findDesignSystems } as unknown as Repository<DesignSystem>,
      {
        find: findRuns,
        createQueryBuilder,
      } as unknown as Repository<GenerationRun>,
    );
  });

  afterEach(() => jest.useRealTimers());

  it('builds an owner-scoped portfolio and service report', async () => {
    const report = await service.report(owner);

    expect(report.summary).toEqual({
      totalDesignSystems: 2,
      requiringAttention: 2,
      generatedRuns: 2,
      successRate: 50,
      failedRuns: 1,
      medianDurationMs: 1_000,
      p95DurationMs: 4_000,
      publicationSuccessRate: 50,
    });
    expect(report.designSystems[0]).toMatchObject({
      id: firstId,
      health: 'attention',
      attentionReason: 'The latest generation failed.',
      componentCount: 12,
      componentDelta: 2,
      warningCount: 2,
    });
    expect(report.designSystems[1]).toMatchObject({
      id: secondId,
      health: 'unproven',
      attentionReason: 'No generation has been run yet.',
    });
    expect(report.periodDays).toBe(7);
    expect(report.generationVolume).toHaveLength(7);
    expect(report.generationVolume.at(-1)).toEqual({
      date: '2026-08-03',
      counts: [
        { designSystemId: firstId, count: 2 },
        { designSystemId: secondId, count: 0 },
      ],
    });
    expect(report.performance.at(-1)).toEqual({
      date: '2026-08-03',
      medianDurationMs: 1_000,
      p95DurationMs: 4_000,
    });
    expect(report.generationEfficiency).toEqual([
      {
        runId: '9aaa7fc7-93c6-46b5-8758-43af6df9c71b',
        designSystemId: firstId,
        designSystemName: 'Primary',
        packageVersion: '1.0.0',
        componentCount: 12,
        artifactCount: 1,
        durationMs: 1_000,
        publishRequested: true,
      },
    ]);
    expect(findDesignSystems).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ownerId: owner.userReferenceId } }),
    );
    expect(createQueryBuilder).toHaveBeenCalledWith('run');
  });

  it('classifies error, stale, and not-yet-successful design systems and skips incomplete durations', async () => {
    const thirdId = 'e490e823-5e6b-4309-a52e-1ec6cc4c4627';
    findDesignSystems.mockResolvedValue([
      designSystem(firstId, 'Errors'),
      designSystem(secondId, 'Stale'),
      designSystem(thirdId, 'Pending'),
    ]);
    const errorRun = run({
      id: 'error',
      designSystemId: firstId,
      status: GenerationRunStatus.SUCCEEDED,
      createdAt: '2026-08-03T08:00:00Z',
      durationMs: 0,
    });
    errorRun.errorCount = 2;
    const staleRun = run({
      id: 'stale',
      designSystemId: secondId,
      status: GenerationRunStatus.SUCCEEDED,
      createdAt: '2026-07-01T08:00:00Z',
      durationMs: 100,
    });
    const pendingRun = run({
      id: 'pending',
      designSystemId: thirdId,
      status: GenerationRunStatus.PENDING,
      createdAt: '2026-08-03T09:00:00Z',
      durationMs: 100,
    });
    pendingRun.startedAt = null;
    pendingRun.completedAt = null;
    getMany.mockResolvedValue([pendingRun]);
    findRuns.mockImplementation(
      ({ where }: { where: Record<string, unknown> }) => {
        const value =
          where.designSystemId === firstId
            ? errorRun
            : where.designSystemId === secondId
              ? staleRun
              : pendingRun;
        return Promise.resolve(
          where.status === GenerationRunStatus.SUCCEEDED &&
            value.status !== GenerationRunStatus.SUCCEEDED
            ? []
            : [value],
        );
      },
    );

    const report = await service.report(owner);
    expect(report.designSystems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: firstId,
          attentionReason:
            '2 generation errors in the latest successful version.',
        }),
        expect.objectContaining({
          id: secondId,
          attentionReason: 'No successful generation in the last 7 days.',
        }),
        expect.objectContaining({
          id: thirdId,
          attentionReason: 'No successful generation yet.',
        }),
      ]),
    );
    expect(report.summary.successRate).toBeNull();
    expect(report.summary.medianDurationMs).toBeNull();
    expect(report.summary.publicationSuccessRate).toBeNull();
    expect(report.generationEfficiency).toEqual([]);
  });

  it('uses singular grammar for one diagnostic error and clamps negative durations', async () => {
    const success = run({
      id: 'single',
      designSystemId: firstId,
      status: GenerationRunStatus.SUCCEEDED,
      createdAt: '2026-08-03T08:00:00Z',
      durationMs: 1,
    });
    success.errorCount = 1;
    success.completedAt = new Date(success.startedAt!.getTime() - 10);
    findDesignSystems.mockResolvedValue([designSystem(firstId, 'Single')]);
    getMany.mockResolvedValue([success]);
    findRuns.mockResolvedValue([success]);
    const report = await service.report(owner);
    expect(report.designSystems[0].attentionReason).toBe(
      '1 generation error in the latest successful version.',
    );
    expect(report.summary.medianDurationMs).toBe(0);
  });

  it('handles terminal runs without timing', async () => {
    findDesignSystems.mockResolvedValue([]);
    const incomplete = run({
      id: 'incomplete',
      designSystemId: 'unknown',
      status: GenerationRunStatus.SUCCEEDED,
      createdAt: '2026-08-03T08:00:00Z',
      durationMs: 1,
    });
    incomplete.startedAt = null;
    incomplete.completedAt = null;
    getMany.mockResolvedValue([incomplete]);
    const report = await service.report(owner);
    expect(report.summary.medianDurationMs).toBeNull();
    expect(report.generationEfficiency).toEqual([]);
  });
});

function chainableBuilder(
  getMany: jest.Mock,
): SelectQueryBuilder<GenerationRun> {
  const builder = {
    innerJoin: jest.fn(),
    where: jest.fn(),
    andWhere: jest.fn(),
    orderBy: jest.fn(),
    addOrderBy: jest.fn(),
    getMany,
  } as unknown as SelectQueryBuilder<GenerationRun>;
  for (const method of [
    'innerJoin',
    'where',
    'andWhere',
    'orderBy',
    'addOrderBy',
  ] as const) {
    (builder[method] as jest.Mock).mockReturnValue(builder);
  }
  return builder;
}

function designSystem(id: string, name: string): DesignSystem {
  return {
    id,
    ownerId: owner.userReferenceId,
    name,
    description: null,
    lastPublishedVersion: null,
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
    updatedAt: new Date('2026-07-01T00:00:00.000Z'),
    owner: undefined as never,
    generationRuns: [],
  };
}

function run({
  id,
  designSystemId,
  status,
  createdAt,
  durationMs,
  componentCount = 0,
  warningCount = 0,
  publishRequested = false,
  publishedAt = null,
}: {
  id: string;
  designSystemId: string;
  status: GenerationRunStatus;
  createdAt: string;
  durationMs: number;
  componentCount?: number;
  warningCount?: number;
  publishRequested?: boolean;
  publishedAt?: string | null;
}): GenerationRun {
  const startedAt = new Date(createdAt);
  return {
    id,
    designSystemId,
    designSystem: designSystem(designSystemId, 'Design system'),
    status,
    startedAt,
    completedAt: new Date(startedAt.getTime() + durationMs),
    packageName: '@kolibri/system',
    packageVersion: '1.0.0',
    publishRequested,
    publishedAt: publishedAt ? new Date(publishedAt) : null,
    publicationFailureSummary: null,
    artifactCount: status === GenerationRunStatus.SUCCEEDED ? 1 : 0,
    tokenCount: 0,
    componentCount,
    warningCount,
    errorCount: 0,
    artifactReference: null,
    failureSummary: null,
    createdAt: new Date(createdAt),
    updatedAt: new Date(createdAt),
    events: [],
  };
}
