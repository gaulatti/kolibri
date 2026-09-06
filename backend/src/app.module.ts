import { Module } from '@nestjs/common';
import { ArtifactsModule } from './artifacts/artifacts.module';
import { AuthModule } from './auth/auth.module';
import { ClientsModule } from './clients/clients.module';
import { CssExporterModule } from './css-exporter/css-exporter.module';
import { DesignSystemsModule } from './design-systems/design-systems.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { FigmaImporterModule } from './figma-importer/figma-importer.module';
import { ExportersModule } from './exporters/exporters.module';
import { GenerationModule } from './generation/generation.module';
import { PackageAssemblerModule } from './package-assembler/package-assembler.module';
import { PersistenceModule } from './persistence/persistence.module';
import { ReportsModule } from './reports/reports.module';

@Module({
  imports: [
    ClientsModule,
    FigmaImporterModule,
    CssExporterModule,
    ExportersModule,
    ArtifactsModule,
    PackageAssemblerModule,
    GenerationModule,
    PersistenceModule,
    AuthModule,
    DesignSystemsModule,
    DashboardModule,
    ReportsModule,
  ],
})
export class AppModule {}
