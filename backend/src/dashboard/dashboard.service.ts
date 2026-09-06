import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import type { AuthenticatedUser } from '../auth/authenticated-user';
import {
  DesignSystem,
  GenerationRun,
  GenerationRunStatus,
} from '../persistence/entities';
import type {
  DashboardPerformancePoint,
  DashboardReport,
  DashboardVolumePoint,
  DesignSystemHealth,
} from './dashboard.types';

const PERIOD_DAYS = 7;

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(DesignSystem)
    private readonly designSystems: Repository<DesignSystem>,
    @InjectRepository(GenerationRun)
    private readonly runs: Repository<GenerationRun>,
  ) {}

  async report(user: AuthenticatedUser): Promise<DashboardReport> {
    const now = new Date();
    const periodStart = startOfUtcDay(now);
    periodStart.setUTCDate(periodStart.getUTCDate() - (PERIOD_DAYS - 1));

    const designSystems = await this.designSystems.find({
      where: { ownerId: user.userReferenceId },
      order: { name: 'ASC', id: 'ASC' },
    });
    const periodRuns = await this.runs
      .createQueryBuilder('run')
      .innerJoin('run.designSystem', 'designSystem')
      .where('designSystem.ownerId = :ownerId', {
        ownerId: user.userReferenceId,
      })
      .andWhere('run.createdAt >= :periodStart', { periodStart })
      .orderBy('run.createdAt', 'ASC')
      .addOrderBy('run.id', 'ASC')
      .getMany();

    const health = await Promise.all(
      designSystems.map((designSystem) =>
        this.designSystemHealth(designSystem, now),
      ),
    );
    const terminalRuns = periodRuns.filter((run) =>
      [GenerationRunStatus.SUCCEEDED, GenerationRunStatus.FAILED].includes(
        run.status,
      ),
    );
    const successfulRuns = terminalRuns.filter(
      (run) => run.status === GenerationRunStatus.SUCCEEDED,
    );
    const failedRuns = terminalRuns.filter(
      (run) => run.status === GenerationRunStatus.FAILED,
    );
    const durations = terminalRuns.flatMap((run) => {
      const duration = durationMs(run);
      return duration === null ? [] : [duration];
    });
    const publicationRuns = periodRuns.filter((run) => run.publishRequested);
    const publishedRuns = publicationRuns.filter((run) => run.publishedAt);

    return {
      generatedAt: now.toISOString(),
      periodDays: PERIOD_DAYS,
      summary: {
        totalDesignSystems: designSystems.length,
        requiringAttention: health.filter((item) => item.health !== 'healthy')
          .length,
        generatedRuns: periodRuns.length,
        successRate: percentage(successfulRuns.length, terminalRuns.length),
        failedRuns: failedRuns.length,
        medianDurationMs: percentile(durations, 50),
        p95DurationMs: percentile(durations, 95),
        publicationSuccessRate: percentage(
          publishedRuns.length,
          publicationRuns.length,
        ),
      },
      designSystems: health,
      generationVolume: volumeSeries(periodStart, designSystems, periodRuns),
      performance: performanceSeries(periodStart, terminalRuns),
      generationEfficiency: efficiencyPoints(successfulRuns, designSystems),
    };
  }

  private async designSystemHealth(
    designSystem: DesignSystem,
    now: Date,
  ): Promise<DesignSystemHealth> {
    const [latestRuns, successfulRuns] = await Promise.all([
      this.runs.find({
        where: { designSystemId: designSystem.id },
        order: { createdAt: 'DESC', id: 'DESC' },
        take: 1,
      }),
      this.runs.find({
        where: {
          designSystemId: designSystem.id,
          status: GenerationRunStatus.SUCCEEDED,
        },
        order: { createdAt: 'DESC', id: 'DESC' },
        take: 2,
      }),
    ]);
    const latest = latestRuns[0] ?? null;
    const latestSuccessful = successfulRuns[0] ?? null;
    const previousSuccessful = successfulRuns[1] ?? null;
    const staleBefore = new Date(now);
    staleBefore.setUTCDate(staleBefore.getUTCDate() - PERIOD_DAYS);

    let health: DesignSystemHealth['health'] = 'healthy';
    let attentionReason: string | null = null;
    if (!latestSuccessful) {
      health = 'unproven';
      attentionReason = latest
        ? 'No successful generation yet.'
        : 'No generation has been run yet.';
    } else if (latest?.status === GenerationRunStatus.FAILED) {
      health = 'attention';
      attentionReason = 'The latest generation failed.';
    } else if (latestSuccessful.errorCount > 0) {
      health = 'attention';
      attentionReason = `${latestSuccessful.errorCount} generation error${latestSuccessful.errorCount === 1 ? '' : 's'} in the latest successful version.`;
    } else if (latestSuccessful.completedAt! < staleBefore) {
      health = 'attention';
      attentionReason = `No successful generation in the last ${PERIOD_DAYS} days.`;
    }

    return {
      id: designSystem.id,
      name: designSystem.name,
      health,
      attentionReason,
      latestStatus: latest?.status ?? null,
      latestRunAt: latest?.createdAt ?? null,
      lastSuccessfulAt: latestSuccessful?.completedAt ?? null,
      currentVersion: latestSuccessful?.packageVersion ?? null,
      lastPublishedVersion: designSystem.lastPublishedVersion,
      componentCount: latestSuccessful?.componentCount ?? null,
      componentDelta:
        latestSuccessful && previousSuccessful
          ? latestSuccessful.componentCount - previousSuccessful.componentCount
          : null,
      warningCount: latestSuccessful?.warningCount ?? null,
      errorCount: latestSuccessful?.errorCount ?? null,
    };
  }
}

function volumeSeries(
  start: Date,
  designSystems: DesignSystem[],
  runs: GenerationRun[],
): DashboardVolumePoint[] {
  return daysFrom(start, PERIOD_DAYS).map((date) => ({
    date,
    counts: designSystems.map((designSystem) => ({
      designSystemId: designSystem.id,
      count: runs.filter(
        (run) =>
          run.designSystemId === designSystem.id &&
          utcDate(run.createdAt) === date,
      ).length,
    })),
  }));
}

function performanceSeries(
  start: Date,
  runs: GenerationRun[],
): DashboardPerformancePoint[] {
  return daysFrom(start, PERIOD_DAYS).map((date) => {
    const durations = runs.flatMap((run) => {
      if (utcDate(run.createdAt) !== date) return [];
      const duration = durationMs(run);
      return duration === null ? [] : [duration];
    });
    return {
      date,
      medianDurationMs: percentile(durations, 50),
      p95DurationMs: percentile(durations, 95),
    };
  });
}

function efficiencyPoints(
  runs: GenerationRun[],
  designSystems: DesignSystem[],
) {
  const names = new Map(
    designSystems.map((designSystem) => [designSystem.id, designSystem.name]),
  );
  return runs.flatMap((run) => {
    const duration = durationMs(run);
    if (duration === null) return [];
    return [
      {
        runId: run.id,
        designSystemId: run.designSystemId,
        designSystemName: names.get(run.designSystemId) ?? 'Design system',
        packageVersion: run.packageVersion,
        componentCount: run.componentCount,
        artifactCount: run.artifactCount,
        durationMs: duration,
        publishRequested: run.publishRequested,
      },
    ];
  });
}

function daysFrom(start: Date, count: number): string[] {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(date.getUTCDate() + index);
    return utcDate(date);
  });
}

function utcDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function startOfUtcDay(value: Date): Date {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}

function durationMs(run: GenerationRun): number | null {
  if (!run.startedAt || !run.completedAt) return null;
  return Math.max(0, run.completedAt.getTime() - run.startedAt.getTime());
}

function percentage(numerator: number, denominator: number): number | null {
  if (!denominator) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function percentile(values: number[], value: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil((value / 100) * sorted.length) - 1);
  return sorted[index];
}
