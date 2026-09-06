import {
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { UserReference } from '../persistence/entities';
import type { AuthenticatedUser } from './authenticated-user';
import { COGNITO_TOKEN_VERIFIER } from './auth.constants';
import type {
  CognitoTokenVerifier,
  VerifiedCognitoIdentity,
} from './cognito-token-verifier';

@Injectable()
export class AuthService {
  constructor(
    @Inject(COGNITO_TOKEN_VERIFIER)
    private readonly tokenVerifier: CognitoTokenVerifier,
    @InjectRepository(UserReference)
    private readonly users: Repository<UserReference>,
  ) {}

  async authenticate(accessToken: string): Promise<AuthenticatedUser> {
    let identity: VerifiedCognitoIdentity;
    try {
      identity = await this.tokenVerifier.verify(accessToken);
    } catch {
      throw new UnauthorizedException(
        'Invalid or expired authentication token',
      );
    }
    const cognitoSub = identity.sub?.trim();

    if (!cognitoSub) {
      throw new ForbiddenException('Authenticated identity is not permitted');
    }

    const user = await this.findOrCreateUser(cognitoSub);
    return {
      userReferenceId: user.id,
      cognitoSub: user.cognitoSub,
    };
  }

  private async findOrCreateUser(cognitoSub: string): Promise<UserReference> {
    const existing = await this.users.findOne({ where: { cognitoSub } });
    if (existing) return existing;

    await this.users.upsert(
      { cognitoSub },
      { conflictPaths: ['cognitoSub'], skipUpdateIfNoValuesChanged: true },
    );
    const user = await this.users.findOne({ where: { cognitoSub } });
    if (!user) throw new Error('User reference could not be resolved');
    return user;
  }
}
