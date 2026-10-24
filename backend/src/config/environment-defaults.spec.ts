import { loadCognitoConfiguration } from '../auth/cognito.config';
import {
  loadDatabaseOptions,
  loadRuntimeDatabaseOptions,
} from '../persistence/database.config';
import { runtimeMode } from './runtime-mode';
import {
  designSystemRuntimeSecretName,
  generationStoragePrefix,
  runtimeNamespace,
  systemSecretName,
} from './runtime-namespace';

describe('process environment configuration entry points', () => {
  const fixture = {
    AWS_REGION: 'us-east-1',
    COGNITO_USER_POOL_ID: 'us-east-1_defaults',
    COGNITO_APP_CLIENT_ID: 'default-fixture-client',
    KOLIBRI_STACK_NAME: 'KolibriDefaultsFixture',
    KOLIBRI_RUNTIME_MODE: 'local',
    DATABASE_HOST: '127.0.0.1',
    DATABASE_PORT: '5439',
    DATABASE_NAME: 'default-fixture',
    DATABASE_USER: 'default-fixture',
    DATABASE_PASSWORD: 'default-fixture',
    DATABASE_SSL: 'false',
  };
  const keys = Object.keys(fixture);
  const previous = Object.fromEntries(
    keys.map((key) => [key, process.env[key]]),
  );

  beforeEach(() => Object.assign(process.env, fixture));
  afterEach(() => {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  });

  it('derives the same namespace for every runtime storage consumer', () => {
    expect(runtimeNamespace()).toBe('KolibriDefaultsFixture');
    expect(systemSecretName()).toBe('KolibriDefaultsFixture/system');
    expect(designSystemRuntimeSecretName()).toBe(
      'KolibriDefaultsFixture/runtime/design-systems',
    );
    expect(generationStoragePrefix()).toBe('KolibriDefaultsFixture');
  });

  it('loads public authentication identifiers without requiring explicit environment injection', () => {
    expect(loadCognitoConfiguration()).toEqual({
      awsRegion: 'us-east-1',
      userPoolId: 'us-east-1_defaults',
      appClientId: 'default-fixture-client',
    });
  });

  it('uses local database overrides consistently in CLI and application entry points', async () => {
    expect(runtimeMode()).toBe('local');
    const cli = loadDatabaseOptions();
    const application = await loadRuntimeDatabaseOptions();
    expect(cli).toMatchObject({
      type: 'postgres',
      host: '127.0.0.1',
      port: 5439,
      database: 'default-fixture',
      username: 'default-fixture',
      password: 'default-fixture',
      ssl: false,
    });
    expect(application).toEqual(cli);
  });
});
