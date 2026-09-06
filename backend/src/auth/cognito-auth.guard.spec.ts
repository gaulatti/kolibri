import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GenerationController } from '../generation/generation.controller';
import type { AuthenticatedRequest } from './authenticated-user';
import type { AuthService } from './auth.service';
import { CognitoAuthGuard } from './cognito-auth.guard';
import { HealthController } from './health.controller';

type TestRequest = Pick<AuthenticatedRequest, 'headers'> &
  Partial<Pick<AuthenticatedRequest, 'user'>>;

function controllerMethod(
  prototype: object,
  name: string,
): (...args: never[]) => unknown {
  const value: unknown = Object.getOwnPropertyDescriptor(
    prototype,
    name,
  )?.value;
  if (typeof value !== 'function') throw new Error(`Missing method: ${name}`);
  return value as (...args: never[]) => unknown;
}

const generationHandler = controllerMethod(
  GenerationController.prototype,
  'generate',
);
const healthHandler = controllerMethod(HealthController.prototype, 'health');

function executionContext(
  request: TestRequest,
  controller: object,
  handler: (...args: never[]) => unknown,
): ExecutionContext {
  return {
    getClass: () => controller.constructor as never,
    getHandler: () => handler,
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => undefined,
      getNext: () => undefined,
    }),
  } as unknown as ExecutionContext;
}

describe('CognitoAuthGuard', () => {
  const authenticate = jest.fn();
  const authService = { authenticate } as unknown as AuthService;
  const guard = new CognitoAuthGuard(new Reflector(), authService);

  beforeEach(() => jest.clearAllMocks());

  it('attaches a verified user context to a protected request', async () => {
    const user = {
      userReferenceId: 'ffed16af-2a32-47eb-a7df-a9650340532c',
      cognitoSub: 'cognito-subject',
    };
    const request: TestRequest = {
      headers: { authorization: 'Bearer verified-access-token' },
    };
    authenticate.mockResolvedValue(user);

    await expect(
      guard.canActivate(
        executionContext(
          request,
          new GenerationController({} as never),
          generationHandler,
        ),
      ),
    ).resolves.toBe(true);
    expect(authenticate).toHaveBeenCalledWith('verified-access-token');
    expect(request.user).toEqual(user);
  });

  it('rejects a protected application route when authentication is missing', async () => {
    const request: TestRequest = { headers: {} };

    await expect(
      guard.canActivate(
        executionContext(
          request,
          new GenerationController({} as never),
          generationHandler,
        ),
      ),
    ).rejects.toEqual(
      expect.objectContaining({
        constructor: UnauthorizedException,
        message: 'Authentication required',
      }),
    );
    expect(authenticate).not.toHaveBeenCalled();
  });

  it('rejects malformed bearer authorization', async () => {
    const request: TestRequest = {
      headers: { authorization: 'Basic credentials' },
    };
    await expect(
      guard.canActivate(
        executionContext(
          request,
          new GenerationController({} as never),
          generationHandler,
        ),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(authenticate).not.toHaveBeenCalled();
  });

  it('bypasses authentication only for an explicitly public route', async () => {
    const request: TestRequest = { headers: {} };
    const controller = new HealthController();

    await expect(
      guard.canActivate(executionContext(request, controller, healthHandler)),
    ).resolves.toBe(true);
    expect(authenticate).not.toHaveBeenCalled();
  });
});
