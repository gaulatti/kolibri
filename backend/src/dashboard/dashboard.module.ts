import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DesignSystem, GenerationRun } from '../persistence/entities';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [TypeOrmModule.forFeature([DesignSystem, GenerationRun])],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
