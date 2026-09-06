import { Module } from '@nestjs/common';
import { CssExporterService } from './css-exporter.service';

@Module({
  providers: [CssExporterService],
  exports: [CssExporterService],
})
export class CssExporterModule {}
