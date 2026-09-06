import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository, SelectQueryBuilder } from 'typeorm';
import type { AuthenticatedUser } from '../auth/authenticated-user';
import { GenerationRun } from '../persistence/entities';
import {
  HistorySortDirection,
  type GenerationHistoryQueryDto,
} from './dto/generation-history-query.dto';
import type {
  GenerationHistoryItem,
  GenerationHistoryResult,
} from './generation-history.types';

@Injectable()
export class GenerationHistoryService {
  constructor(
    @InjectRepository(GenerationRun)
    private readonly runs: Repository<GenerationRun>,
  ) {}

  async search(
    user: AuthenticatedUser,
    filters: GenerationHistoryQueryDto,
  ): Promise<GenerationHistoryResult> {
    const { startDate, endDate } = this.dateRange(filters);
    const query = this.ownerScopedQuery(user);
    this.applyFilters(query, filters, startDate, endDate);

    const direction =
      filters.sortDirection === HistorySortDirection.ASC ? 'ASC' : 'DESC';
    query
      .orderBy('run.createdAt', direction)
      .addOrderBy('run.id', direction)
      .skip((filters.page - 1) * filters.pageSize)
      .take(filters.pageSize);

    const [runs, totalItems] = await query.getManyAndCount();
    const totalPages = Math.ceil(totalItems / filters.pageSize);
    return {
      items: runs.map((run) => this.toHistoryItem(run)),
      pagination: {
        page: filters.page,
        pageSize: filters.pageSize,
        totalItems,
        totalPages,
        hasPreviousPage: filters.page > 1,
        hasNextPage: filters.page < totalPages,
      },
    };
  }

  private ownerScopedQuery(
    user: AuthenticatedUser,
  ): SelectQueryBuilder<GenerationRun> {
    return this.runs
      .createQueryBuilder('run')
      .innerJoinAndSelect('run.designSystem', 'designSystem')
      .select([
        'run.id',
        'run.designSystemId',
        'run.status',
        'run.startedAt',
        'run.completedAt',
        'run.packageName',
        'run.packageVersion',
        'run.artifactCount',
        'run.artifactReference',
        'run.tokenCount',
        'run.componentCount',
        'run.warningCount',
        'run.errorCount',
        'run.failureSummary',
        'run.createdAt',
        'run.updatedAt',
        'designSystem.id',
        'designSystem.name',
      ])
      .where('designSystem.ownerId = :ownerId', {
        ownerId: user.userReferenceId,
      });
  }

  private applyFilters(
    query: SelectQueryBuilder<GenerationRun>,
    filters: GenerationHistoryQueryDto,
    startDate?: Date,
    endDate?: Date,
  ): void {
    if (filters.designSystemId) {
      query.andWhere('run.designSystemId = :designSystemId', {
        designSystemId: filters.designSystemId,
      });
    }
    if (filters.text) {
      query.andWhere(
        '(designSystem.name ILIKE :historyText OR run.packageName ILIKE :historyText)',
        { historyText: `%${filters.text}%` },
      );
    }
    if (filters.status) {
      query.andWhere('run.status = :status', { status: filters.status });
    }
    if (startDate) {
      query.andWhere('run.createdAt >= :startDate', { startDate });
    }
    if (endDate) {
      query.andWhere('run.createdAt <= :endDate', { endDate });
    }
  }

  private dateRange(filters: GenerationHistoryQueryDto): {
    startDate?: Date;
    endDate?: Date;
  } {
    const startDate = filters.startDate
      ? this.parseDate(filters.startDate, false)
      : undefined;
    const endDate = filters.endDate
      ? this.parseDate(filters.endDate, true)
      : undefined;
    if (startDate && endDate && startDate > endDate) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        errors: [
          {
            field: 'endDate',
            messages: ['endDate must be on or after startDate'],
          },
        ],
      });
    }
    return { startDate, endDate };
  }

  private parseDate(value: string, endOfDay: boolean): Date {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return new Date(
        `${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`,
      );
    }
    return new Date(value);
  }

  private toHistoryItem(run: GenerationRun): GenerationHistoryItem {
    return {
      id: run.id,
      designSystemId: run.designSystemId,
      designSystemName: run.designSystem.name,
      packageName: run.packageName,
      packageVersion: run.packageVersion,
      status: run.status,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      artifactCount: run.artifactCount,
      artifactAvailable: Boolean(run.artifactReference),
      tokenCount: run.tokenCount,
      componentCount: run.componentCount,
      warningCount: run.warningCount,
      errorCount: run.errorCount,
      failureSummary: run.failureSummary,
      createdAt: run.createdAt,
      updatedAt: run.updatedAt,
    };
  }
}
