const create = jest.fn();
jest.mock('@nestjs/core', () => ({
  ...jest.requireActual('@nestjs/core'),
  NestFactory: { create: (...args: unknown[]) => create(...args) },
}));

describe('application process bootstrap', () => {
  const keys = ['PORT', 'CORS_ALLOWED_ORIGINS'] as const;
  const previous = Object.fromEntries(
    keys.map((key) => [key, process.env[key]]),
  );

  afterEach(() => {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  });

  it.each([
    {
      port: undefined,
      origins: undefined,
      expectedPort: 3000,
      expectedOrigins: [
        'https://kolibri.dev',
        'http://localhost:5173',
        'http://localhost:5188',
      ],
    },
    {
      port: '3188',
      origins: ' https://example.test , , https://other.example.test ',
      expectedPort: 3188,
      expectedOrigins: ['https://example.test', 'https://other.example.test'],
    },
  ])(
    'registers validation, explicit CORS and port $expectedPort before listening',
    async (input) => {
      if (input.port === undefined) delete process.env.PORT;
      else process.env.PORT = input.port;
      if (input.origins === undefined) delete process.env.CORS_ALLOWED_ORIGINS;
      else process.env.CORS_ALLOWED_ORIGINS = input.origins;
      const app = {
        useGlobalPipes: jest.fn(),
        enableCors: jest.fn(),
        listen: jest.fn().mockResolvedValue(undefined),
      };
      create.mockResolvedValue(app);
      await jest.isolateModulesAsync(async () => {
        jest.requireActual('./main');
        await new Promise<void>((resolve) => setImmediate(resolve));
      });
      expect(create).toHaveBeenCalledWith(expect.any(Function));
      expect(app.useGlobalPipes).toHaveBeenCalledWith(
        expect.objectContaining({
          validatorOptions: expect.objectContaining({
            whitelist: true,
            forbidNonWhitelisted: true,
          }),
        }),
      );
      expect(app.enableCors).toHaveBeenCalledWith({
        origin: input.expectedOrigins,
        methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Authorization', 'Content-Type'],
        exposedHeaders: ['Content-Disposition', 'Content-Type'],
      });
      expect(app.listen).toHaveBeenCalledWith(input.expectedPort);
      expect(app.useGlobalPipes.mock.invocationCallOrder[0]).toBeLessThan(
        app.listen.mock.invocationCallOrder[0],
      );
      expect(app.enableCors.mock.invocationCallOrder[0]).toBeLessThan(
        app.listen.mock.invocationCallOrder[0],
      );
    },
  );
});
