import { Controller, Get, Query } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { GenerationHistoryQueryDto } from '../generation/dto/generation-history-query.dto';
import { GenerationHistoryReportService } from './generation-history-report.service';
import type { GenerationHistoryReport } from './generation-history-report.types';

@Controller('v1/reports')
export class ReportsController {
  constructor(
    private readonly generationHistoryReport: GenerationHistoryReportService,
  ) {}

  @Get('generation-history')
  generationHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Query() filters: GenerationHistoryQueryDto,
  ): Promise<GenerationHistoryReport> {
    return this.generationHistoryReport.generate(user, filters);
  }
}
