import { Body, Controller, Get, Param, Patch, Put } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { DesignSystemIdParams } from '../design-systems/dto/design-system-id.params';
import {
  DesignSystemSecretsService,
  type RuntimeConfigurationView,
  type RuntimeConfiguredView,
} from './design-system-secrets.service';
import { SetDesignSystemRuntimeConfigurationDto } from './dto/set-design-system-runtime-configuration.dto';
import { SetDesignSystemRuntimeCredentialsDto } from './dto/set-design-system-runtime-credentials.dto';

@Controller('v1/design-systems')
export class DesignSystemCredentialsController {
  constructor(private readonly secrets: DesignSystemSecretsService) {}

  @Get(':id/runtime-configuration')
  getRuntimeConfiguration(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: DesignSystemIdParams,
  ): Promise<RuntimeConfigurationView> {
    return this.secrets.getRuntimeConfigurationView(user, params.id);
  }

  @Patch(':id/runtime-configuration')
  setRuntimeConfiguration(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: DesignSystemIdParams,
    @Body() input: SetDesignSystemRuntimeConfigurationDto,
  ): Promise<RuntimeConfigurationView> {
    return this.secrets.setRuntimeConfiguration(user, params.id, input);
  }

  @Put(':id/runtime-credentials')
  setRuntimeCredentials(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: DesignSystemIdParams,
    @Body() input: SetDesignSystemRuntimeCredentialsDto,
  ): Promise<RuntimeConfiguredView> {
    return this.secrets.setRuntimeCredentials(user, params.id, input);
  }
}
