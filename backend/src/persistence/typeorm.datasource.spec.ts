import type { DataSource } from 'typeorm';

describe('migration CLI data source', () => {
  const fixture = {
    KOLIBRI_RUNTIME_MODE: 'local',
    DATABASE_HOST: '127.0.0.1',
    DATABASE_PORT: '5439',
    DATABASE_NAME: 'migration-fixture',
    DATABASE_USER: 'migration-fixture',
    DATABASE_PASSWORD: 'migration-fixture',
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

  it('shares validated application settings without opening a database connection during import', async () => {
    await jest.isolateModulesAsync(async () => {
      const { default: pending } = jest.requireActual<{
        default: Promise<DataSource>;
      }>('./typeorm.datasource');
      const database = await pending;
      expect(database.options).toMatchObject({
        type: 'postgres',
        host: '127.0.0.1',
        port: 5439,
        database: 'migration-fixture',
        migrationsRun: false,
        synchronize: false,
      });
      expect(database.options.entities).toHaveLength(4);
      expect(database.options.migrations).toHaveLength(5);
      expect(database.isInitialized).toBe(false);
    });
  });

  it('rejects invalid runtime configuration before a migration can connect', async () => {
    process.env.DATABASE_PORT = 'invalid';
    await jest.isolateModulesAsync(async () => {
      const { default: pending } = jest.requireActual<{
        default: Promise<DataSource>;
      }>('./typeorm.datasource');
      await expect(pending).rejects.toThrow('DATABASE_PORT');
    });
  });
});
