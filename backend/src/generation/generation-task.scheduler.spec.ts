import { ImmediateGenerationTaskScheduler } from './generation-task.scheduler';

describe('ImmediateGenerationTaskScheduler', () => {
  afterEach(() => jest.useRealTimers());

  it('executes a queued task and contains its rejection', async () => {
    jest.useFakeTimers();
    const scheduler = new ImmediateGenerationTaskScheduler();
    const task = jest.fn().mockRejectedValue(new Error('contained'));

    scheduler.schedule(task);
    await jest.runAllTimersAsync();

    expect(task).toHaveBeenCalledTimes(1);
  });
});
