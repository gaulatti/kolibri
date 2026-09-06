import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule } from '../clients/clients.module';
import { CssExporterModule } from '../css-exporter/css-exporter.module';
import { ExportersModule } from '../exporters/exporters.module';
import { FigmaImporterModule } from '../figma-importer/figma-importer.module';
import { PackageAssemblerModule } from '../package-assembler/package-assembler.module';
import { NpmPublicationModule } from '../npm-publication/npm-publication.module';
import {
  DesignSystem,
  GenerationEvent,
  GenerationRun,
} from '../persistence/entities';
import { SecretsModule } from '../secrets/secrets.module';
import { StorageModule } from '../storage/storage.module';
import { GenerationController } from './generation.controller';
import { GenerationEventsService } from './generation-events.service';
import { GenerationHistoryService } from './generation-history.service';
import { GenerationService } from './generation.service';
import {
  GENERATION_TASK_SCHEDULER,
  ImmediateGenerationTaskScheduler,
} from './generation-task.scheduler';

@Module({
  imports: [
    TypeOrmModule.forFeature([DesignSystem, GenerationRun, GenerationEvent]),
    ClientsModule,
    FigmaImporterModule,
    CssExporterModule,
    ExportersModule,
    PackageAssemblerModule,
    NpmPublicationModule,
    StorageModule,
    SecretsModule,
  ],
  controllers: [GenerationController],
  providers: [
    GenerationService,
    GenerationEventsService,
    GenerationHistoryService,
    {
      provide: GENERATION_TASK_SCHEDULER,
      useClass: ImmediateGenerationTaskScheduler,
    },
  ],
  exports: [GenerationService, GenerationHistoryService],
})
export class GenerationModule {}
