import { lastValueFrom, toArray } from 'rxjs';
import type { Repository } from 'typeorm';
import { GenerationEvent } from '../persistence/entities';
import { GenerationEventsService } from './generation-events.service';
import { GENERATION_PHASES } from './generation.types';

describe('GenerationEventsService', () => {
  const runId = 'f515082d-5e8b-4309-a52e-1ec6cc4c4627';
  const create = jest.fn();
  const save = jest.fn();
  const find = jest.fn();
  let sequence = 0;
  let service: GenerationEventsService;

  beforeEach(() => {
    jest.clearAllMocks();
    sequence = 0;
    create.mockImplementation(
      (input: Partial<GenerationEvent>): GenerationEvent => ({
        id: `event-${++sequence}`,
        generationRunId: runId,
        generationRun: undefined as never,
        eventType: input.eventType!,
        message: input.message!,
        createdAt: new Date(`2026-08-01T12:00:0${sequence}.000Z`),
      }),
    );
    save.mockImplementation((event: GenerationEvent) => Promise.resolve(event));
    find.mockResolvedValue([]);
    service = new GenerationEventsService({
      create,
      save,
      find,
    } as unknown as Repository<GenerationEvent>);
  });

  it('persists progress events and replays them through SSE data', async () => {
    const queued = await service.record(
      runId,
      GENERATION_PHASES.QUEUED,
      'Generation queued.',
    );
    const completed = await service.record(
      runId,
      GENERATION_PHASES.COMPLETED,
      'Generation completed successfully.',
    );
    find.mockResolvedValue([queued, completed]);

    const messages = await lastValueFrom(
      (await service.stream(runId, true)).pipe(toArray()),
    );
    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({
      id: queued.id,
      type: GENERATION_PHASES.QUEUED,
      data: { message: 'Generation queued.' },
    });
    expect(find).toHaveBeenCalledWith({
      where: { generationRunId: runId },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
    expect(save).toHaveBeenCalledTimes(2);
  });

  it('reuses a live stream, de-duplicates replayed events, and closes it on terminal status', async () => {
    const queued = await service.record(
      runId,
      GENERATION_PHASES.QUEUED,
      'Queued',
    );
    find.mockResolvedValue([queued]);
    const first = await service.stream(runId, false);
    const second = await service.stream(runId, false);
    const result = lastValueFrom(first.pipe(toArray()));
    const secondResult = lastValueFrom(second.pipe(toArray()));
    await service.record(
      runId,
      GENERATION_PHASES.RETRIEVING_SOURCE,
      'Retrieving source',
    );
    await service.record(runId, GENERATION_PHASES.COMPLETED, 'Completed');
    await expect(result).resolves.toHaveLength(3);
    await expect(secondResult).resolves.toHaveLength(3);
  });
});
