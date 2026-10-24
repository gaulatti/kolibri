import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import type { AuthenticatedRequest } from '../auth/authenticated-user';
import { createGlobalValidationPipe } from '../common/validation/global-validation.pipe';
import { DesignSystemCredentialsController } from './design-system-credentials.controller';
import { DesignSystemSecretsService } from './design-system-secrets.service';

const authenticatedUser = {
  userReferenceId: 'f1dca655-7cf7-4269-9380-53e260251a39',
  cognitoSub: 'owner-cognito-sub',
};
const designSystemId = 'a0e14f52-e0d1-4acd-a937-9626e7c8c04d';

@Injectable()
class TestAuthenticatedGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    context.switchToHttp().getRequest<AuthenticatedRequest>().user =
      authenticatedUser;
    return true;
  }
}

describe('design-system runtime-configuration route registration', () => {
  let app: INestApplication<App>;
  let httpServer: App;
  const getRuntimeConfigurationView = jest.fn();
  const setRuntimeConfiguration = jest.fn();
  const setRuntimeCredentials = jest.fn();

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [DesignSystemCredentialsController],
      providers: [
        {
          provide: DesignSystemSecretsService,
          useValue: {
            getRuntimeConfigurationView,
            setRuntimeConfiguration,
            setRuntimeCredentials,
          },
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
    getRuntimeConfigurationView.mockResolvedValue({
      designSystemId,
      figmaFileKey: 'AbCdEf_123-xyz',
      packageName: '@kolibri/ui',
      packageVersion: '1.0.0',
      npmRegistry: 'https://registry.npmjs.org',
      figmaAccessTokenConfigured: true,
      npmTokenConfigured: false,
      generationConfigured: true,
    });
    setRuntimeConfiguration.mockResolvedValue({
      designSystemId,
      figmaFileKey: 'AbCdEf_123-xyz',
      packageName: '@kolibri/ui',
      packageVersion: '1.0.0',
      npmRegistry: 'https://registry.npmjs.org/',
      figmaAccessTokenConfigured: true,
      npmTokenConfigured: false,
      generationConfigured: true,
    });
    setRuntimeCredentials.mockResolvedValue({
      designSystemId,
      configured: true,
    });
  });

  it('reads and updates non-secret runtime configuration', async () => {
    const read = await request(httpServer)
      .get(`/v1/design-systems/${designSystemId}/runtime-configuration`)
      .expect(200);
    expect(read.body).toMatchObject({
      figmaFileKey: 'AbCdEf_123-xyz',
      packageName: '@kolibri/ui',
      figmaAccessTokenConfigured: true,
    });
    expect(read.text).not.toContain('sensitive');

    const input = {
      figmaFileKey: 'https://www.figma.com/design/AbCdEf_123-xyz/Kolibri',
      packageName: '@kolibri/ui',
    };
    await request(httpServer)
      .patch(`/v1/design-systems/${designSystemId}/runtime-configuration`)
      .send(input)
      .expect(200);

    expect(setRuntimeConfiguration).toHaveBeenCalledWith(
      authenticatedUser,
      designSystemId,
      { ...input, figmaFileKey: 'AbCdEf_123-xyz' },
    );
  });

  it('accepts Figma and npm tokens as independent write-only updates', async () => {
    const figmaResponse = await request(httpServer)
      .put(`/v1/design-systems/${designSystemId}/runtime-credentials`)
      .send({ figmaAccessToken: 'sensitive-figma-token' })
      .expect(200)
      .expect({ designSystemId, configured: true });
    expect(setRuntimeCredentials).toHaveBeenLastCalledWith(
      authenticatedUser,
      designSystemId,
      { figmaAccessToken: 'sensitive-figma-token' },
    );

    const npmResponse = await request(httpServer)
      .put(`/v1/design-systems/${designSystemId}/runtime-credentials`)
      .send({ npmToken: 'sensitive-npm-token' })
      .expect(200)
      .expect({ designSystemId, configured: true });

    expect(setRuntimeCredentials).toHaveBeenLastCalledWith(
      authenticatedUser,
      designSystemId,
      { npmToken: 'sensitive-npm-token' },
    );
    expect(figmaResponse.text).not.toContain('sensitive-figma-token');
    expect(npmResponse.text).not.toContain('sensitive-npm-token');
  });

  it('rejects invalid and unexpected runtime properties', async () => {
    await request(httpServer)
      .patch(`/v1/design-systems/${designSystemId}/runtime-configuration`)
      .send({
        figmaFileKey: 'figd_this-is-an-access-token',
        packageName: 'Invalid Package Name',
        packageVersion: 'not-semver',
        ownerId: authenticatedUser.userReferenceId,
      })
      .expect(400);
    expect(setRuntimeConfiguration).not.toHaveBeenCalled();
  });
});
