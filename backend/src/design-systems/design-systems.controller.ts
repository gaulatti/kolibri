import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/authenticated-user';
import type { DesignSystemView } from './design-system.view';
import { DesignSystemsService } from './design-systems.service';
import { CreateDesignSystemDto } from './dto/create-design-system.dto';
import { DesignSystemIdParams } from './dto/design-system-id.params';
import { UpdateDesignSystemDto } from './dto/update-design-system.dto';

@Controller('v1/design-systems')
export class DesignSystemsController {
  constructor(private readonly designSystems: DesignSystemsService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: CreateDesignSystemDto,
  ): Promise<DesignSystemView> {
    return this.designSystems.create(user, input);
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<DesignSystemView[]> {
    return this.designSystems.list(user);
  }

  @Get(':id')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: DesignSystemIdParams,
  ): Promise<DesignSystemView> {
    return this.designSystems.get(user, params.id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: DesignSystemIdParams,
    @Body() input: UpdateDesignSystemDto,
  ): Promise<DesignSystemView> {
    return this.designSystems.update(user, params.id, input);
  }

  @Delete(':id')
  @HttpCode(204)
  delete(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: DesignSystemIdParams,
  ): Promise<void> {
    return this.designSystems.delete(user, params.id);
  }
}
