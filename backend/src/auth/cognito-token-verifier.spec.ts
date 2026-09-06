import { UnauthorizedException } from '@nestjs/common';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { AwsCognitoTokenVerifier } from './cognito-token-verifier';

describe('AwsCognitoTokenVerifier', () => {
  const verify = jest.fn();
  const create = jest.spyOn(CognitoJwtVerifier, 'create');

  beforeEach(() => {
    jest.clearAllMocks();
    create.mockReturnValue({ verify } as never);
  });

  afterAll(() => create.mockRestore());

  it('constructs an access-token verifier and returns its identity', async () => {
    verify.mockResolvedValue({ sub: 'cognito-sub' });
    const verifier = new AwsCognitoTokenVerifier({
      awsRegion: 'us-east-1',
      userPoolId: 'us-east-1_fixture',
      appClientId: 'client-id',
    });

    await expect(verifier.verify('access-token')).resolves.toEqual({
      sub: 'cognito-sub',
    });
    expect(create).toHaveBeenCalledWith({
      userPoolId: 'us-east-1_fixture',
      tokenUse: 'access',
      clientId: 'client-id',
      includeRawJwtInErrors: false,
    });
  });

  it('maps verification details to a safe unauthorized response', async () => {
    verify.mockRejectedValue(new Error('sensitive verifier detail'));
    const verifier = new AwsCognitoTokenVerifier({
      awsRegion: 'us-east-1',
      userPoolId: 'us-east-1_fixture',
      appClientId: 'client-id',
    });

    await expect(verifier.verify('invalid-token')).rejects.toEqual(
      new UnauthorizedException('Invalid or expired authentication token'),
    );
  });
});
