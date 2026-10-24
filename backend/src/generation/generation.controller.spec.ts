import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { Readable } from 'node:stream';
import { of } from 'rxjs';
import request from 'supertest';
import type { App } from 'supertest/types';
import type { AuthenticatedRequest } from '../auth/authenticated-user';
import { createGlobalValidationPipe } from '../common/validation/global-validation.pipe';
import { GenerationRunStatus } from '../persistence/entities';
import { GenerationController } from './generation.controller';
import { GenerationEventsService } from './generation-events.service';
import { GenerationHistoryService } from './generation-history.service';
import { GenerationService } from './generation.service';

const authenticatedUser = {
  userReferenceId: 'f1dca655-7cf7-4269-9380-53e260251a39',
  cognitoSub: 'owner-cognito-sub',
};
const designSystemId = 'a0e14f52-e0d1-4acd-a937-9626e7c8c04d';
const runId = '4849766f-aa4d-4dfd-b23b-d77f34ddb664';
const runView = {
  id: runId,
  designSystemId,
  status: GenerationRunStatus.SUCCEEDED,
  startedAt: new Date('2026-08-01T12:00:01.000Z'),
  completedAt: new Date('2026-08-01T12:00:02.000Z'),
  artifactCount: 10,
  tokenCount: 3,
  componentCount: 2,
  warningCount: 1,
  errorCount: 0,
  packageName: '@kolibri/ui',
  packageVersion: '1.0.0',
  publishRequested: false,
  publishedAt: null,
  publicationFailureSummary: null,
  artifactReference: `artifacts/runs/${runId}/kolibri-ui`,
  failureSummary: null,
  createdAt: new Date('2026-08-01T12:00:00.000Z'),
  updatedAt: new Date('2026-08-01T12:00:02.000Z'),
};

@Injectable()
class TestAuthenticatedGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    context.switchToHttp().getRequest<AuthenticatedRequest>().user =
      authenticatedUser;
    return true;
  }
}

describe('generation route registration and ownership', () => {
  let app: INestApplication<App>;
  let httpServer: App;
  const queue = jest.fn();
  const getOwnedRun = jest.fn();
  const getArtifactAccess = jest.fn();
  const stream = jest.fn();
  const search = jest.fn();

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [GenerationController],
      providers: [
        {
          provide: GenerationService,
          useValue: { queue, getOwnedRun, getArtifactAccess },
        },
        { provide: GenerationEventsService, useValue: { stream } },
        { provide: GenerationHistoryService, useValue: { search } },
        { provide: APP_GUARD, useClass: TestAuthenticatedGuard },
      ],
    }).compile();
    app = module.createNestApplication<INestApplication<App>>();
    app.useGlobalPipes(createGlobalValidationPipe());
    await app.init();
    httpServer = app.getHttpServer();
  });

  afterAll(async () => app.close());

  beforeEach(() => {
    jest.clearAllMocks();
    queue.mockResolvedValue({ runId, status: GenerationRunStatus.PENDING });
    getOwnedRun.mockResolvedValue(runView);
    getArtifactAccess.mockResolvedValue({
      kind: 'redirect',
      url: 'https://private-download.example/signed',
      expiresInSeconds: 300,
    });
    stream.mockResolvedValue(
      of({
        id: 'event-id',
        type: 'completed',
        data: { message: 'Generation completed successfully.' },
      }),
    );
    search.mockResolvedValue({
      items: [runView],
      pagination: {
        page: 1,
        pageSize: 25,
        totalItems: 1,
        totalPages: 1,
        hasPreviousPage: false,
        hasNextPage: false,
      },
    });
  });

  it('registers validated generation history filters and defaults', async () => {
    await request(httpServer).get('/v1/generations').expect(200);
    expect(search).toHaveBeenCalledWith(
      authenticatedUser,
      expect.objectContaining({
        page: 1,
        pageSize: 25,
        sortDirection: 'desc',
      }),
    );

    await request(httpServer)
      .get('/v1/generations')
      .query({
        designSystemId,
        text: '  Kolibri  ',
        status: 'SUCCEEDED',
        startDate: '2026-08-01',
        endDate: '2026-08-31',
        page: '2',
        pageSize: '10',
        sortDirection: 'ASC',
      })
      .expect(200);
    expect(search).toHaveBeenLastCalledWith(
      authenticatedUser,
      expect.objectContaining({
        designSystemId,
        text: 'Kolibri',
        status: 'succeeded',
        startDate: '2026-08-01',
        endDate: '2026-08-31',
        page: 2,
        pageSize: 10,
        sortDirection: 'asc',
      }),
    );
  });

  it('rejects invalid history filters and excessive page sizes', async () => {
    await request(httpServer)
      .get('/v1/generations')
      .query({ status: 'unknown' })
      .expect(400);
    await request(httpServer)
      .get('/v1/generations')
      .query({ pageSize: '101' })
      .expect(400);
    await request(httpServer)
      .get('/v1/generations')
      .query({ startDate: 'not-a-date' })
      .expect(400);
    await request(httpServer)
      .get('/v1/generations')
      .query({ unexpected: 'value' })
      .expect(400);
  });

  it('registers an authenticated owner-scoped artifact route', async () => {
    await request(httpServer)
      .get(`/v1/generations/${runId}/artifact`)
      .expect('cache-control', 'private, no-store')
      .expect(200)
      .expect({
        kind: 'presigned',
        downloadUrl: 'https://private-download.example/signed',
        expiresInSeconds: 300,
      });
    expect(getArtifactAccess).toHaveBeenCalledWith(authenticatedUser, runId);

    getArtifactAccess.mockResolvedValueOnce({
      kind: 'stream',
      stream: Readable.from([Buffer.from('PK')]),
      contentType: 'application/zip',
      filename: 'kolibri-ui.zip',
    });
    await request(httpServer)
      .get(`/v1/generations/${runId}/artifact`)
      .expect('content-type', 'application/zip')
      .expect('content-disposition', 'attachment; filename="kolibri-ui.zip"')
      .expect('cache-control', 'private, no-store')
      .expect(200);

    getArtifactAccess.mockRejectedValueOnce(
      new NotFoundException('Generation run not found'),
    );
    await request(httpServer)
      .get(`/v1/generations/${runId}/artifact`)
      .expect(404);
  });

  it('registers validated generation and owner-scoped status routes', async () => {
    await request(httpServer)
      .post('/v1/generations')
      .send({ designSystemId })
      .expect(202)
      .expect({ runId, status: GenerationRunStatus.PENDING });
    expect(queue).toHaveBeenCalledWith(
      authenticatedUser,
      designSystemId,
      false,
    );

    await request(httpServer)
      .post('/v1/generations')
      .send({ designSystemId, publishToNpm: true })
      .expect(202);
    expect(queue).toHaveBeenLastCalledWith(
      authenticatedUser,
      designSystemId,
      true,
    );

    await request(httpServer).get(`/v1/generations/${runId}`).expect(200);
    expect(getOwnedRun).toHaveBeenCalledWith(authenticatedUser, runId);

    await request(httpServer)
      .post('/v1/generations')
      .send({ designSystemId, figmaToken: 'must-not-be-accepted' })
      .expect(400);
  });

  it('registers SSE and verifies ownership before opening the stream', async () => {
    await request(httpServer)
      .get(`/v1/generations/${runId}/events`)
      .expect('content-type', /text\/event-stream/)
      .expect(200);
    expect(getOwnedRun).toHaveBeenCalledWith(authenticatedUser, runId);
    expect(stream).toHaveBeenCalledWith(runId, true);

    stream.mockClear();
    getOwnedRun.mockRejectedValueOnce(
      new NotFoundException('Generation run not found'),
    );
    await request(httpServer)
      .get(`/v1/generations/${runId}/events`)
      .expect(404);
    expect(stream).not.toHaveBeenCalled();
  });

  it.each([
    [GenerationRunStatus.FAILED, true],
    [GenerationRunStatus.RUNNING, false],
  ])(
    'keeps SSE terminal behavior consistent for %s runs',
    async (status, terminal) => {
      getOwnedRun.mockResolvedValueOnce({ ...runView, status });
      await request(httpServer)
        .get(`/v1/generations/${runId}/events`)
        .expect(200);
      expect(stream).toHaveBeenCalledWith(runId, terminal);
    },
  );
});
