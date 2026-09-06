import { Module } from '@nestjs/common';
import { GenerationModule } from '../generation/generation.module';
import { GenerationHistoryReportService } from './generation-history-report.service';
import { ReportsController } from './reports.controller';

@Module({
  imports: [GenerationModule],
  controllers: [ReportsController],
  providers: [GenerationHistoryReportService],
})
export class ReportsModule {}
