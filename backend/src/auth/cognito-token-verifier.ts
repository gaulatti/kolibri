import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import type { CognitoConfiguration } from './cognito.config';
import {
  COGNITO_CONFIGURATION,
  COGNITO_TOKEN_VERIFIER,
} from './auth.constants';

export type VerifiedCognitoIdentity = {
  sub?: string;
};

export interface CognitoTokenVerifier {
  verify(accessToken: string): Promise<VerifiedCognitoIdentity>;
}

@Injectable()
export class AwsCognitoTokenVerifier implements CognitoTokenVerifier {
  private readonly verifier: {
    verify(accessToken: string): Promise<VerifiedCognitoIdentity>;
  };

  constructor(
    @Inject(COGNITO_CONFIGURATION) configuration: CognitoConfiguration,
  ) {
    this.verifier = CognitoJwtVerifier.create({
      userPoolId: configuration.userPoolId,
      tokenUse: 'access',
      clientId: configuration.appClientId,
      includeRawJwtInErrors: false,
    });
  }

  async verify(accessToken: string): Promise<VerifiedCognitoIdentity> {
    try {
      return await this.verifier.verify(accessToken);
    } catch {
      throw new UnauthorizedException(
        'Invalid or expired authentication token',
      );
    }
  }
}

export const cognitoTokenVerifierProvider = {
  provide: COGNITO_TOKEN_VERIFIER,
  useClass: AwsCognitoTokenVerifier,
};
