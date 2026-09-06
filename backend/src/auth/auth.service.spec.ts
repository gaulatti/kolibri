import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { UserReference } from '../persistence/entities';
import { AuthService } from './auth.service';
import type { CognitoTokenVerifier } from './cognito-token-verifier';

function userReference(cognitoSub = 'cognito-subject'): UserReference {
  return {
    id: '9ddf576d-fe24-4d1f-a8b6-ab121823c224',
    cognitoSub,
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    designSystems: [],
  };
}

describe('AuthService', () => {
  const verify = jest.fn();
  const findOne = jest.fn();
  const upsert = jest.fn();
  const verifier = { verify } as CognitoTokenVerifier;
  const repository = {
    findOne,
    upsert,
  } as unknown as Repository<UserReference>;
  const service = new AuthService(verifier, repository);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses the verified Cognito sub to produce the authenticated user context', async () => {
    const user = userReference();
    verify.mockResolvedValue({ sub: 'cognito-subject' });
    findOne.mockResolvedValue(user);

    await expect(
      service.authenticate('verified-access-token'),
    ).resolves.toEqual({
      userReferenceId: user.id,
      cognitoSub: 'cognito-subject',
    });
    expect(verify).toHaveBeenCalledWith('verified-access-token');
    expect(findOne).toHaveBeenCalledWith({
      where: { cognitoSub: 'cognito-subject' },
    });
    expect(upsert).not.toHaveBeenCalled();
  });

  it('creates only the minimum user reference when one does not exist', async () => {
    const saved = userReference('new-cognito-subject');
    verify.mockResolvedValue({ sub: 'new-cognito-subject' });
    findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(saved);
    upsert.mockResolvedValue(undefined);

    await expect(
      service.authenticate('verified-access-token'),
    ).resolves.toEqual({
      userReferenceId: saved.id,
      cognitoSub: 'new-cognito-subject',
    });
    expect(upsert).toHaveBeenCalledWith(
      { cognitoSub: 'new-cognito-subject' },
      {
        conflictPaths: ['cognitoSub'],
        skipUpdateIfNoValuesChanged: true,
      },
    );
    expect(findOne).toHaveBeenLastCalledWith({
      where: { cognitoSub: 'new-cognito-subject' },
    });
  });

  it('fails safely if an upsert cannot be read back', async () => {
    verify.mockResolvedValue({ sub: 'new-subject' });
    findOne.mockResolvedValue(null);
    upsert.mockResolvedValue(undefined);
    await expect(service.authenticate('token')).rejects.toThrow(
      'User reference could not be resolved',
    );
  });

  it('returns a safe 401 for invalid or expired authentication', async () => {
    verify.mockRejectedValue(
      new Error('expired token with verification implementation details'),
    );

    await expect(service.authenticate('invalid-access-token')).rejects.toEqual(
      expect.objectContaining({
        constructor: UnauthorizedException,
        message: 'Invalid or expired authentication token',
      }),
    );
    expect(findOne).not.toHaveBeenCalled();
  });

  it('returns a safe 403 when a verified token has no usable subject', async () => {
    verify.mockResolvedValue({});

    await expect(service.authenticate('verified-access-token')).rejects.toEqual(
      expect.objectContaining({
        constructor: ForbiddenException,
        message: 'Authenticated identity is not permitted',
      }),
    );
    expect(findOne).not.toHaveBeenCalled();
  });
});
