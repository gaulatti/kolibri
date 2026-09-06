import { Controller, Get } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Reflector, APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { GenerationController } from '../generation/generation.controller';
import { GenerationEventsService } from '../generation/generation-events.service';
import { GenerationHistoryService } from '../generation/generation-history.service';
import { GenerationService } from '../generation/generation.service';
import { GenerationHistoryReportService } from '../reports/generation-history-report.service';
import { ReportsController } from '../reports/reports.controller';
import type { AuthenticatedUser } from './authenticated-user';
import { AuthService } from './auth.service';
import { CognitoAuthGuard } from './cognito-auth.guard';
import { CurrentUser } from './current-user.decorator';
import { HealthController } from './health.controller';

@Controller('auth-context-test')
class AuthContextTestController {
  @Get()
  context(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }
}

describe('authentication HTTP boundary', () => {
  let app: INestApplication<App>;
  let httpServer: App;
  const queue = jest.fn();
  const authenticate = jest.fn();
  const generateReport = jest.fn();

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [
        GenerationController,
        HealthController,
        AuthContextTestController,
        ReportsController,
      ],
      providers: [
        Reflector,
        { provide: GenerationService, useValue: { queue } },
        { provide: GenerationEventsService, useValue: { stream: jest.fn() } },
        { provide: GenerationHistoryService, useValue: { search: jest.fn() } },
        {
          provide: GenerationHistoryReportService,
          useValue: { generate: generateReport },
        },
        { provide: AuthService, useValue: { authenticate } },
        { provide: APP_GUARD, useClass: CognitoAuthGuard },
      ],
    }).compile();
    app = module.createNestApplication<App>();
    await app.init();
    httpServer = app.getHttpServer();
  });

  it('rejects the report route without authentication', async () => {
    await request(httpServer).get('/v1/reports/generation-history').expect(401);
    expect(generateReport).not.toHaveBeenCalled();
  });

  afterAll(async () => app.close());

  beforeEach(() => jest.clearAllMocks());

  it('rejects the protected generation route before invoking generation', async () => {
    await request(httpServer)
      .post('/v1/generations')
      .expect(401)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          statusCode: 401,
          message: 'Authentication required',
        });
      });
    expect(authenticate).not.toHaveBeenCalled();
    expect(queue).not.toHaveBeenCalled();
  });

  it('allows the explicitly public health route', async () => {
    await request(httpServer)
      .get('/health')
      .expect(200)
      .expect({ status: 'ok' });
    expect(authenticate).not.toHaveBeenCalled();
  });

  it('provides the typed current user through the controller decorator', async () => {
    const user = {
      userReferenceId: '3ebaa2c7-6d4b-4682-8a9d-67d105905261',
      cognitoSub: 'cognito-subject',
    };
    authenticate.mockResolvedValue(user);

    await request(httpServer)
      .get('/auth-context-test')
      .set('authorization', 'Bearer verified-access-token')
      .expect(200)
      .expect(user);
    expect(authenticate).toHaveBeenCalledWith('verified-access-token');
  });
});
