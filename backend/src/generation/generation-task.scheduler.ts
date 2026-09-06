import { Injectable } from '@nestjs/common';

export const GENERATION_TASK_SCHEDULER = Symbol('GENERATION_TASK_SCHEDULER');

export interface GenerationTaskScheduler {
  schedule(task: () => Promise<void>): void;
}

@Injectable()
export class ImmediateGenerationTaskScheduler implements GenerationTaskScheduler {
  schedule(task: () => Promise<void>): void {
    setImmediate(() => void task().catch(() => undefined));
  }
}
