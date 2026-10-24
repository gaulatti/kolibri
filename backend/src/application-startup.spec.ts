import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from './app.module';
import { createGlobalValidationPipe } from './common/validation/global-validation.pipe';
import { loadDatabaseOptions } from './persistence/database.config';
import * as systemSecret from './config/kolibri-system-secret';
import { GenerationStorage } from './storage/generation-storage';
import { S3GenerationStorage } from './storage/s3-generation.storage';

describe('complete application module', () => {
  const keys = [
    'AWS_REGION',
    'COGNITO_USER_POOL_ID',
    'COGNITO_APP_CLIENT_ID',
    'KOLIBRI_RUNTIME_MODE',
    'KOLIBRI_STACK_NAME',
  ] as const;
  const previous = Object.fromEntries(
    keys.map((key) => [key, process.env[key]]),
  );
  let app: INestApplication | undefined;

  beforeEach(() => {
    process.env.AWS_REGION = 'us-east-1';
    process.env.COGNITO_USER_POOL_ID = 'us-east-1_startupFixture';
    process.env.COGNITO_APP_CLIENT_ID = 'startup-client';
    process.env.KOLIBRI_RUNTIME_MODE = 'local';
    process.env.KOLIBRI_STACK_NAME = 'KolibriStartupFixture';
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await app?.close();
    app = undefined;
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  });

  it('resolves the full provider graph and retains public-health/private-route boundaries', async () => {
    // This checks the actual module graph without connecting to PostgreSQL.
    // Database migrations and query behavior have their own integration checks.
    const database = new DataSource(
      loadDatabaseOptions({
        DATABASE_HOST: '127.0.0.1',
        DATABASE_USER: 'startup-fixture',
        DATABASE_PASSWORD: 'startup-fixture',
        DATABASE_NAME: 'startup-fixture',
      }),
    );
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DataSource)
      .useValue(database)
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(createGlobalValidationPipe());
    await app.init();

    await request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ status: 'ok' });
    for (const path of [
      '/v1/design-systems',
      '/v1/generations',
      '/v1/dashboard',
    ]) {
      await request(app.getHttpServer()).get(path).expect(401);
    }
    expect(database.isInitialized).toBe(false);
  });

  it('fails startup when the authentication configuration is missing', async () => {
    delete process.env.COGNITO_APP_CLIENT_ID;
    const database = new DataSource(
      loadDatabaseOptions({
        DATABASE_HOST: '127.0.0.1',
        DATABASE_USER: 'startup-fixture',
        DATABASE_PASSWORD: 'startup-fixture',
        DATABASE_NAME: 'startup-fixture',
      }),
    );
    await expect(
      Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(DataSource)
        .useValue(database)
        .compile(),
    ).rejects.toThrow('COGNITO_APP_CLIENT_ID');
    expect(database.isInitialized).toBe(false);
  });

  it('selects production secret and storage providers without making a cloud request at startup', async () => {
    process.env.KOLIBRI_RUNTIME_MODE = 'production';
    const load = jest
      .spyOn(systemSecret, 'loadKolibriSystemSecret')
      .mockResolvedValue({
        storage: {
          driver: 's3',
          bucket: 'startup-fixture-bucket',
          presignedUrlTtlSeconds: 300,
        },
        postgresql: {
          host: '127.0.0.1',
          database: 'startup-fixture',
          username: 'startup-fixture',
          password: 'startup-fixture',
        },
      });
    const database = new DataSource(
      loadDatabaseOptions({
        DATABASE_HOST: '127.0.0.1',
        DATABASE_USER: 'startup-fixture',
        DATABASE_PASSWORD: 'startup-fixture',
        DATABASE_NAME: 'startup-fixture',
      }),
    );
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DataSource)
      .useValue(database)
      .compile();
    app = module.createNestApplication();
    await app.init();
    expect(app.get(GenerationStorage)).toBeInstanceOf(S3GenerationStorage);
    expect(load).toHaveBeenCalledWith(process.env);
    expect(database.isInitialized).toBe(false);
  });
});
