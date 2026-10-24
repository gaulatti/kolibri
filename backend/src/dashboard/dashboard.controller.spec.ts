import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import type { AuthenticatedRequest } from '../auth/authenticated-user';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

const user = {
  userReferenceId: 'ac935c68-a0d0-4d3c-bbae-0be3eed29f83',
  cognitoSub: 'owner-sub',
};

@Injectable()
class AuthenticatedGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    context.switchToHttp().getRequest<AuthenticatedRequest>().user = user;
    return true;
  }
}

describe('dashboard route', () => {
  let app: INestApplication<App>;
  const report = jest.fn();

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [
        { provide: DashboardService, useValue: { report } },
        { provide: APP_GUARD, useClass: AuthenticatedGuard },
      ],
    }).compile();
    app = module.createNestApplication<INestApplication<App>>();
    await app.init();
  });

  afterAll(async () => app.close());
  beforeEach(() => {
    jest.clearAllMocks();
    report.mockResolvedValue({
      generatedAt: '2026-08-03T12:00:00.000Z',
      periodDays: 7,
      summary: {},
      designSystems: [],
      generationVolume: [],
      performance: [],
      generationEfficiency: [],
    });
  });

  it('registers an authenticated owner-scoped dashboard endpoint', async () => {
    await request(app.getHttpServer()).get('/v1/dashboard').expect(200);
    expect(report).toHaveBeenCalledWith(user);
  });
});
