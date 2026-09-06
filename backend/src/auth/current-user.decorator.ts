import {
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import type {
  AuthenticatedRequest,
  AuthenticatedUser,
} from './authenticated-user';

export function currentUserFromContext(
  context: ExecutionContext,
): AuthenticatedUser {
  const request = context
    .switchToHttp()
    .getRequest<Partial<AuthenticatedRequest>>();
  if (!request.user)
    throw new ForbiddenException('Authenticated user context is unavailable');
  return request.user;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext) =>
    currentUserFromContext(context),
);
