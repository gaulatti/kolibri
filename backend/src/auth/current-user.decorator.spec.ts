import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { currentUserFromContext } from './current-user.decorator';

describe('current user context', () => {
  const context = (user?: unknown) =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    }) as ExecutionContext;
  it('returns the authenticated user and rejects a missing context', () => {
    const user = { userReferenceId: 'id', cognitoSub: 'sub' };
    expect(currentUserFromContext(context(user))).toBe(user);
    expect(() => currentUserFromContext(context())).toThrow(ForbiddenException);
  });
});
