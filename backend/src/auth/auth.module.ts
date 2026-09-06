import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserReference } from '../persistence/entities';
import { COGNITO_CONFIGURATION } from './auth.constants';
import { AuthService } from './auth.service';
import { CognitoAuthGuard } from './cognito-auth.guard';
import { loadCognitoConfiguration } from './cognito.config';
import { cognitoTokenVerifierProvider } from './cognito-token-verifier';
import { HealthController } from './health.controller';

@Module({
  imports: [TypeOrmModule.forFeature([UserReference])],
  controllers: [HealthController],
  providers: [
    {
      provide: COGNITO_CONFIGURATION,
      useFactory: () => loadCognitoConfiguration(process.env),
    },
    cognitoTokenVerifierProvider,
    AuthService,
    {
      provide: APP_GUARD,
      useClass: CognitoAuthGuard,
    },
  ],
  exports: [AuthService],
})
export class AuthModule {}
