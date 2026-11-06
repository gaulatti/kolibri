import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AppModule } from './app.module';

const fakeDataSource = {
  options: { type: 'postgres' },
  getRepository: () => ({}),
  entityMetadatas: [],
  isInitialized: true,
  destroy: () => Promise.resolve(undefined),
};

describe('AppModule dependency graph', () => {
  const saved = { ...process.env };

  beforeEach(() => {
    for (const key of Object.keys(process.env)) delete process.env[key];
    Object.assign(process.env, {
      NODE_ENV: 'test',
      DATABASE_HOST: 'localhost',
      DATABASE_PORT: '5432',
      DATABASE_NAME: 'kolibri',
      DATABASE_USER: 'kolibri',
      DATABASE_PASSWORD: 'unit-test-only',
      AWS_REGION: 'us-east-1',
      COGNITO_USER_POOL_ID: 'us-east-1_unitpool',
      COGNITO_APP_CLIENT_ID: 'unit-client',
    });
  });

  afterEach(() => {
    for (const key of Object.keys(process.env)) delete process.env[key];
    Object.assign(process.env, saved);
  });

  it('compiles and resolves every provider with only the database connection replaced', async () => {
    const dataSource = fakeDataSource;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(getDataSourceToken())
      .useValue(dataSource)
      .overrideProvider(DataSource)
      .useValue(dataSource)
      .compile();
    expect(moduleRef.get(AppModule)).toBeInstanceOf(AppModule);
    await moduleRef.close();
  });

  it('compiles in production mode, selecting the AWS-backed providers from the system secret', async () => {
    process.env.KOLIBRI_RUNTIME_MODE = 'production';
    const send = jest
      .spyOn(SecretsManagerClient.prototype, 'send')
      .mockResolvedValue({
        SecretString: JSON.stringify({
          postgresql: {
            host: 'db.internal',
            database: 'kolibri',
            username: 'kolibri',
            password: 'unit-test-only',
          },
          storage: {
            driver: 's3',
            bucket: 'unit-test-bucket',
            presignedUrlTtlSeconds: 300,
          },
        }),
      } as never);
    try {
      const moduleRef = await Test.createTestingModule({
        imports: [AppModule],
      })
        .overrideProvider(getDataSourceToken())
        .useValue(fakeDataSource)
        .overrideProvider(DataSource)
        .useValue(fakeDataSource)
        .compile();
      expect(moduleRef.get(AppModule)).toBeInstanceOf(AppModule);
      expect(send).toHaveBeenCalled();
      await moduleRef.close();
    } finally {
      send.mockRestore();
    }
  });
});
