import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Res,
  Sse,
  StreamableFile,
  type MessageEvent,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import type { Response } from 'express';
import type { AuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { GenerationEventsService } from './generation-events.service';
import { GenerationHistoryService } from './generation-history.service';
import { GenerationService } from './generation.service';
import { CreateGenerationDto } from './dto/create-generation.dto';
import { GenerationHistoryQueryDto } from './dto/generation-history-query.dto';
import { GenerationIdParams } from './dto/generation-id.params';
import { GenerationRunStatus } from '../persistence/entities';
import type {
  GenerationQueuedView,
  GenerationRunView,
} from './generation.types';
import type { GenerationHistoryResult } from './generation-history.types';

type PresignedArtifactView = {
  kind: 'presigned';
  downloadUrl: string;
  expiresInSeconds: number;
};

@Controller('v1/generations')
export class GenerationController {
  constructor(
    private readonly generationService: GenerationService,
    private readonly generationEvents: GenerationEventsService,
    private readonly generationHistory: GenerationHistoryService,
  ) {}

  @Post()
  @HttpCode(202)
  generate(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: CreateGenerationDto,
  ): Promise<GenerationQueuedView> {
    return this.generationService.queue(
      user,
      input.designSystemId,
      input.publishToNpm === true,
    );
  }

  @Get()
  history(
    @CurrentUser() user: AuthenticatedUser,
    @Query() filters: GenerationHistoryQueryDto,
  ): Promise<GenerationHistoryResult> {
    return this.generationHistory.search(user, filters);
  }

  @Get(':id')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: GenerationIdParams,
  ): Promise<GenerationRunView> {
    return this.generationService.getOwnedRun(user, params.id);
  }

  @Get(':id/artifact')
  async artifact(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: GenerationIdParams,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile | PresignedArtifactView> {
    const access = await this.generationService.getArtifactAccess(
      user,
      params.id,
    );
    if (access.kind === 'redirect') {
      response.setHeader('Cache-Control', 'private, no-store');
      return {
        kind: 'presigned',
        downloadUrl: access.url,
        expiresInSeconds: access.expiresInSeconds,
      };
    }
    response.setHeader('Content-Type', access.contentType);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${access.filename}"`,
    );
    response.setHeader('Cache-Control', 'private, no-store');
    return new StreamableFile(access.stream);
  }

  @Sse(':id/events')
  async events(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: GenerationIdParams,
  ): Promise<Observable<MessageEvent>> {
    const run = await this.generationService.getOwnedRun(user, params.id);
    const terminal =
      run.status === GenerationRunStatus.SUCCEEDED ||
      run.status === GenerationRunStatus.FAILED;
    return this.generationEvents.stream(run.id, terminal);
  }
}
