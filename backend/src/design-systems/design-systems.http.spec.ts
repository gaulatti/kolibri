import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import type { AuthenticatedRequest } from '../auth/authenticated-user';
import { createGlobalValidationPipe } from '../common/validation/global-validation.pipe';
import type { DesignSystemView } from './design-system.view';
import { DesignSystemsController } from './design-systems.controller';
import { DesignSystemsService } from './design-systems.service';

const authenticatedUser = {
  userReferenceId: 'f1dca655-7cf7-4269-9380-53e260251a39',
  cognitoSub: 'owner-cognito-sub',
};
const designSystemId = 'a0e14f52-e0d1-4acd-a937-9626e7c8c04d';
const view: DesignSystemView = {
  id: designSystemId,
  name: 'Kolibri UI',
  description: 'Shared application components',
  generationContract: 'composable-v1',
  lastPublishedVersion: null,
  createdAt: new Date('2026-08-01T12:00:00.000Z'),
  updatedAt: new Date('2026-08-01T12:00:00.000Z'),
};

@Injectable()
class TestAuthenticatedGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    context.switchToHttp().getRequest<AuthenticatedRequest>().user =
      authenticatedUser;
    return true;
  }
}

describe('design-system route registration', () => {
  let app: INestApplication<App>;
  let httpServer: App;
  const create = jest.fn();
  const list = jest.fn();
  const get = jest.fn();
  const update = jest.fn();
  const remove = jest.fn();

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [DesignSystemsController],
      providers: [
        {
          provide: DesignSystemsService,
          useValue: { create, list, get, update, delete: remove },
        },
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
    create.mockResolvedValue(view);
    list.mockResolvedValue([view]);
    get.mockResolvedValue(view);
    update.mockResolvedValue({ ...view, name: 'Updated UI' });
    remove.mockResolvedValue(undefined);
  });

  it('registers create, list, get, update, and delete routes', async () => {
    await request(httpServer)
      .post('/v1/design-systems')
      .send({
        name: '  Kolibri UI  ',
        description: '  Shared application components  ',
        generationContract: 'composable-v1',
      })
      .expect(201);
    expect(create).toHaveBeenCalledWith(authenticatedUser, {
      name: 'Kolibri UI',
      description: 'Shared application components',
      generationContract: 'composable-v1',
    });

    await request(httpServer).get('/v1/design-systems').expect(200);
    expect(list).toHaveBeenCalledWith(authenticatedUser);

    await request(httpServer)
      .get(`/v1/design-systems/${designSystemId}`)
      .expect(200);
    expect(get).toHaveBeenCalledWith(authenticatedUser, designSystemId);

    await request(httpServer)
      .patch(`/v1/design-systems/${designSystemId}`)
      .send({ name: '  Updated UI  ' })
      .expect(200);
    expect(update).toHaveBeenCalledWith(authenticatedUser, designSystemId, {
      name: 'Updated UI',
    });

    await request(httpServer)
      .delete(`/v1/design-systems/${designSystemId}`)
      .expect(204);
    expect(remove).toHaveBeenCalledWith(authenticatedUser, designSystemId);
  });

  it('rejects unknown generation contracts', async () => {
    await request(httpServer)
      .post('/v1/design-systems')
      .send({ name: 'Kolibri UI', generationContract: 'experimental' })
      .expect(400);
    expect(create).not.toHaveBeenCalled();
  });
});
