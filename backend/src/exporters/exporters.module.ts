import { Module } from '@nestjs/common';
import { ReactExporterService } from './react/react-exporter.service';

@Module({
  providers: [ReactExporterService],
  exports: [ReactExporterService],
})
export class ExportersModule {}
