/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access -- these specs load modules in isolation with require() to control evaluation order */
describe('typeorm CLI data source', () => {
  const saved = { ...process.env };

  afterEach(() => {
    for (const key of Object.keys(process.env)) delete process.env[key];
    Object.assign(process.env, saved);
  });

  it('exports a data source built from the runtime database options', async () => {
    Object.assign(process.env, {
      NODE_ENV: 'test',
      DATABASE_HOST: 'localhost',
      DATABASE_PORT: '5432',
      DATABASE_NAME: 'kolibri',
      DATABASE_USER: 'kolibri',
      DATABASE_PASSWORD: 'unit-test-only',
    });
    let loaded: Promise<{ options: { type: string; host?: string } }>;
    jest.isolateModules(() => {
      jest.doMock('dotenv/config', () => ({}));
      loaded = require('./typeorm.datasource').default;
    });
    const dataSource = await loaded!;
    expect(dataSource.options.type).toBe('postgres');
    expect(dataSource.options.host).toBe('localhost');
  });
});
