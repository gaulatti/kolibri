import { Injectable, type MessageEvent } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  concat,
  map,
  type Observable,
  ReplaySubject,
  distinct,
  from,
} from 'rxjs';
import type { Repository } from 'typeorm';
import { GenerationEvent } from '../persistence/entities';
import type { GenerationEventView, GenerationPhase } from './generation.types';
import { GENERATION_PHASES } from './generation.types';

@Injectable()
export class GenerationEventsService {
  private readonly liveStreams = new Map<
    string,
    ReplaySubject<GenerationEvent>
  >();

  constructor(
    @InjectRepository(GenerationEvent)
    private readonly events: Repository<GenerationEvent>,
  ) {}

  async record(
    generationRunId: string,
    eventType: GenerationPhase,
    message: string,
  ): Promise<GenerationEvent> {
    const event = await this.events.save(
      this.events.create({ generationRunId, eventType, message }),
    );
    const stream = this.liveStreams.get(generationRunId);
    stream?.next(event);
    if (
      eventType === GENERATION_PHASES.COMPLETED ||
      eventType === GENERATION_PHASES.FAILED
    ) {
      stream?.complete();
      this.liveStreams.delete(generationRunId);
    }
    return event;
  }

  async stream(
    generationRunId: string,
    isTerminal: boolean,
  ): Promise<Observable<MessageEvent>> {
    const live = isTerminal
      ? undefined
      : this.getOrCreateLiveStream(generationRunId);
    const persisted = await this.events.find({
      where: { generationRunId },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
    const eventStream = live
      ? concat(from(persisted), live).pipe(distinct((event) => event.id))
      : from(persisted);

    return eventStream.pipe(
      map((event) => ({
        id: event.id,
        type: event.eventType,
        data: this.toView(event),
      })),
    );
  }

  private getOrCreateLiveStream(
    generationRunId: string,
  ): ReplaySubject<GenerationEvent> {
    let stream = this.liveStreams.get(generationRunId);
    if (!stream) {
      stream = new ReplaySubject<GenerationEvent>();
      this.liveStreams.set(generationRunId, stream);
    }
    return stream;
  }

  private toView(event: GenerationEvent): GenerationEventView {
    return {
      id: event.id,
      eventType: event.eventType,
      message: event.message,
      createdAt: event.createdAt,
    };
  }
}
