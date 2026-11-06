/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-return -- these specs load modules in isolation with require() to control evaluation order */
const create = jest.fn();

jest.mock('dotenv/config', () => ({}));
jest.mock('@nestjs/core', () => ({
  NestFactory: { create: (...args: unknown[]) => create(...args) },
}));
jest.mock('./app.module', () => ({ AppModule: class AppModule {} }));

describe('bootstrap', () => {
  const saved = { ...process.env };
  const app = {
    useGlobalPipes: jest.fn(),
    enableCors: jest.fn(),
    listen: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    create.mockResolvedValue(app);
    app.listen.mockResolvedValue(undefined);
    delete process.env.CORS_ALLOWED_ORIGINS;
    delete process.env.PORT;
  });

  afterAll(() => {
    for (const key of Object.keys(process.env)) delete process.env[key];
    Object.assign(process.env, saved);
  });

  async function boot(): Promise<void> {
    jest.isolateModules(() => {
      require('./main');
    });
    await new Promise((resolve) => setImmediate(resolve));
  }

  it('uses the documented default origins and port 3000', async () => {
    await boot();
    expect(create).toHaveBeenCalledTimes(1);
    expect(app.useGlobalPipes).toHaveBeenCalledTimes(1);
    expect(app.enableCors).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: [
          'https://kolibri.dev',
          'http://localhost:5173',
          'http://localhost:5188',
        ],
        allowedHeaders: ['Authorization', 'Content-Type'],
      }),
    );
    expect(app.listen).toHaveBeenCalledWith(3000);
  });

  it('honors configured origins (trimmed, empties dropped) and PORT', async () => {
    process.env.CORS_ALLOWED_ORIGINS =
      ' https://a.example , ,https://b.example';
    process.env.PORT = '4100';
    await boot();
    expect(app.enableCors).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: ['https://a.example', 'https://b.example'],
      }),
    );
    expect(app.listen).toHaveBeenCalledWith(4100);
  });
});
