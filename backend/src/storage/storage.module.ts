import { S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Module } from '@nestjs/common';
import { ArtifactsModule } from '../artifacts/artifacts.module';
import { loadKolibriSystemSecret } from '../config/kolibri-system-secret';
import { generationStoragePrefix } from '../config/runtime-namespace';
import { runtimeMode } from '../config/runtime-mode';
import { GenerationStorage } from './generation-storage';
import { LocalGenerationStorage } from './local-generation.storage';
import { S3GenerationStorage } from './s3-generation.storage';
import {
  LOCAL_STORAGE_OUTPUT_DIRECTORY,
  S3_STORAGE_BUCKET,
  S3_STORAGE_CLIENT,
  S3_STORAGE_PREFIX,
  S3_STORAGE_PRESIGNED_TTL,
  S3_STORAGE_PRESIGNER,
  STORAGE_CONFIGURATION,
} from './storage.constants';
import {
  storageConfiguration,
  type StorageConfiguration,
} from './storage.config';

export function selectGenerationStorage(
  driver: string,
  local: LocalGenerationStorage,
  s3: S3GenerationStorage,
): GenerationStorage {
  if (driver === 'local') return local;
  if (driver === 's3') return s3;
  throw new Error('Storage driver must be local or s3');
}

@Module({
  imports: [ArtifactsModule],
  providers: [
    LocalGenerationStorage,
    S3GenerationStorage,
    {
      provide: GenerationStorage,
      inject: [
        STORAGE_CONFIGURATION,
        LocalGenerationStorage,
        S3GenerationStorage,
      ],
      useFactory: (
        configuration: StorageConfiguration,
        local: LocalGenerationStorage,
        s3: S3GenerationStorage,
      ) => selectGenerationStorage(configuration.driver, local, s3),
    },
    {
      provide: LOCAL_STORAGE_OUTPUT_DIRECTORY,
      useValue: 'artifacts',
    },
    {
      provide: S3_STORAGE_CLIENT,
      useFactory: () => new S3Client({ region: process.env.AWS_REGION }),
    },
    {
      provide: S3_STORAGE_BUCKET,
      inject: [STORAGE_CONFIGURATION],
      useFactory: (configuration: StorageConfiguration) => configuration.bucket,
    },
    {
      provide: S3_STORAGE_PREFIX,
      useFactory: () => generationStoragePrefix(process.env),
    },
    {
      provide: S3_STORAGE_PRESIGNED_TTL,
      inject: [STORAGE_CONFIGURATION],
      useFactory: (configuration: StorageConfiguration) =>
        configuration.presignedUrlTtlSeconds,
    },
    { provide: S3_STORAGE_PRESIGNER, useValue: getSignedUrl },
    {
      provide: STORAGE_CONFIGURATION,
      useFactory: async () =>
        storageConfiguration(
          runtimeMode(process.env) === 'production'
            ? await loadKolibriSystemSecret(process.env)
            : null,
        ),
    },
  ],
  exports: [GenerationStorage],
})
export class StorageModule {}
