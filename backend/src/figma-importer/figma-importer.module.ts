import { Module } from '@nestjs/common';
import { FigmaImporterService } from './figma-importer.service';

@Module({
  providers: [FigmaImporterService],
  exports: [FigmaImporterService],
})
export class FigmaImporterModule {}
