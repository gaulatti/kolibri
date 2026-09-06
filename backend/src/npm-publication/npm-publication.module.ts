import { Module } from '@nestjs/common';
import { SystemConfigurationModule } from '../config/system-configuration.module';
import {
  NPM_PROCESS_RUNNER,
  NPM_REGISTRY_FETCH,
} from './npm-publication.constants';
import { NpmPublicationService } from './npm-publication.service';
import { SpawnNpmProcessRunner } from './npm-process.runner';

@Module({
  imports: [SystemConfigurationModule],
  providers: [
    NpmPublicationService,
    SpawnNpmProcessRunner,
    {
      provide: NPM_PROCESS_RUNNER,
      useExisting: SpawnNpmProcessRunner,
    },
    {
      provide: NPM_REGISTRY_FETCH,
      useFactory: (): typeof fetch => globalThis.fetch,
    },
  ],
  exports: [NpmPublicationService],
})
export class NpmPublicationModule {}
