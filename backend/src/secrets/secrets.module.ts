import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DesignSystem } from '../persistence/entities';
import { designSystemRuntimeSecretName } from '../config/runtime-namespace';
import { runtimeMode } from '../config/runtime-mode';
import { SystemConfigurationModule } from '../config/system-configuration.module';
import { NpmPublicationModule } from '../npm-publication/npm-publication.module';
import { DesignSystemCredentialsController } from './design-system-credentials.controller';
import { DesignSystemSecretsService } from './design-system-secrets.service';
import { LocalRuntimeConfigurationClient } from './local-runtime-configuration.client';
import {
  DESIGN_SYSTEM_RUNTIME_SECRET_NAME,
  SECRETS_MANAGER_CLIENT,
} from './secrets.constants';

@Module({
  imports: [
    TypeOrmModule.forFeature([DesignSystem]),
    NpmPublicationModule,
    SystemConfigurationModule,
  ],
  controllers: [DesignSystemCredentialsController],
  providers: [
    DesignSystemSecretsService,
    {
      provide: SECRETS_MANAGER_CLIENT,
      useFactory: () =>
        runtimeMode(process.env) === 'production'
          ? new SecretsManagerClient({ region: process.env.AWS_REGION })
          : new LocalRuntimeConfigurationClient(),
    },
    {
      provide: DESIGN_SYSTEM_RUNTIME_SECRET_NAME,
      useFactory: () => designSystemRuntimeSecretName(process.env),
    },
  ],
  exports: [DesignSystemSecretsService],
})
export class SecretsModule {}
