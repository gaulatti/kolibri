import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import type { AuthenticatedRequest } from '../auth/authenticated-user';
import { createGlobalValidationPipe } from '../common/validation/global-validation.pipe';
import { GenerationHistoryReportService } from './generation-history-report.service';
import { ReportsController } from './reports.controller';

const authenticatedUser = {
  userReferenceId: 'f1dca655-7cf7-4269-9380-53e260251a39',
  cognitoSub: 'owner-cognito-sub',
};

@Injectable()
class TestAuthenticatedGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    context.switchToHttp().getRequest<AuthenticatedRequest>().user =
      authenticatedUser;
    return true;
  }
}

describe('generation-history report route', () => {
  let app: INestApplication<App>;
  let httpServer: App;
  const generate = jest.fn();

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [
        { provide: GenerationHistoryReportService, useValue: { generate } },
        { provide: APP_GUARD, useClass: TestAuthenticatedGuard },
      ],
    }).compile();
    app = module.createNestApplication<App>();
    app.useGlobalPipes(createGlobalValidationPipe());
    await app.init();
    httpServer = app.getHttpServer();
  });

  afterAll(async () => app.close());

  beforeEach(() => {
    jest.clearAllMocks();
    generate.mockResolvedValue({
      title: 'Generation History Report',
      generatedAt: '2026-08-01T12:00:00.000Z',
      appliedFilters: {},
      columns: [{ key: 'status', label: 'Status' }],
      pagination: { totalItems: 0 },
      rows: [],
    });
  });

  it('registers the route, transforms filters, and passes owner context', async () => {
    await request(httpServer)
      .get('/v1/reports/generation-history')
      .query({
        text: '  Kolibri  ',
        status: 'SUCCEEDED',
        page: '2',
        pageSize: '10',
        sortDirection: 'ASC',
      })
      .expect(200);

    expect(generate).toHaveBeenCalledWith(
      authenticatedUser,
      expect.objectContaining({
        text: 'Kolibri',
        status: 'succeeded',
        page: 2,
        pageSize: 10,
        sortDirection: 'asc',
      }),
    );
  });

  it('reuses history validation for report filters', async () => {
    await request(httpServer)
      .get('/v1/reports/generation-history')
      .query({ status: 'unknown' })
      .expect(400);
    await request(httpServer)
      .get('/v1/reports/generation-history')
      .query({ pageSize: '101' })
      .expect(400);
    expect(generate).not.toHaveBeenCalled();
  });
});
