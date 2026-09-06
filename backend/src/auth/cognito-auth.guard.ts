import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedRequest } from './authenticated-user';
import { IS_PUBLIC_ROUTE } from './auth.constants';
import { AuthService } from './auth.service';

@Injectable()
export class CognitoAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC_ROUTE,
      [context.getHandler(), context.getClass()],
    );
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const accessToken = bearerToken(request.headers.authorization);
    request.user = await this.authService.authenticate(accessToken);
    return true;
  }
}

function bearerToken(authorization?: string): string {
  if (!authorization) {
    throw new UnauthorizedException('Authentication required');
  }
  const match = /^Bearer\s+(\S+)$/i.exec(authorization.trim());
  if (!match) {
    throw new UnauthorizedException('Authentication required');
  }
  return match[1];
}
