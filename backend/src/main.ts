import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { createGlobalValidationPipe } from './common/validation/global-validation.pipe';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(createGlobalValidationPipe());
  const allowedOrigins = (
    process.env.CORS_ALLOWED_ORIGINS ||
    'https://kolibri.dev,http://localhost:5173,http://localhost:5188'
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({
    origin: allowedOrigins,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    exposedHeaders: ['Content-Disposition', 'Content-Type'],
  });
  await app.listen(Number(process.env.PORT) || 3000);
}

void bootstrap();
