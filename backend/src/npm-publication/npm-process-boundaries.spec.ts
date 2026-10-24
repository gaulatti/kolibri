import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { SpawnNpmProcessRunner } from './npm-process.runner';

describe('npm operating-system process boundaries', () => {
  const processes =
    jest.requireActual<typeof import('node:child_process')>(
      'node:child_process',
    );
  afterEach(() => jest.restoreAllMocks());

  function childFixture() {
    const child = Object.assign(new EventEmitter(), {
      stdout: new PassThrough(),
      stderr: new PassThrough(),
    });
    jest
      .spyOn(processes, 'spawn')
      .mockReturnValue(child as unknown as ReturnType<typeof processes.spawn>);
    return child;
  }

  it('preserves signal termination when the operating system supplies no numeric exit code', async () => {
    const child = childFixture();
    const operation = new SpawnNpmProcessRunner().run('/fixture', [
      'run',
      'build',
    ]);
    const rejected = expect(operation).rejects.toMatchObject({
      name: 'NpmProcessError',
      command: 'npm run build',
      signal: 'SIGTERM',
      exitCode: undefined,
      message: 'npm run build failed after signal SIGTERM',
    });
    child.emit('exit', null, 'SIGTERM');
    await rejected;
  });

  it('bounds accumulated process output before retaining sanitized diagnostic text', async () => {
    const child = childFixture();
    const operation = new SpawnNpmProcessRunner().run('/fixture', [
      'run',
      'build',
    ]);
    let failure: unknown;
    const rejected = operation.catch((error: unknown) => {
      failure = error;
    });
    child.stdout.emit('data', `old-marker${'x'.repeat(20000)}`);
    child.stderr.emit('data', `old-marker${'y'.repeat(20000)}`);
    child.emit('exit', 1, null);
    await rejected;
    expect(failure).toMatchObject({ exitCode: 1 });
    const diagnostics = failure as { stdout: string; stderr: string };
    expect(diagnostics.stdout).not.toContain('old-marker');
    expect(diagnostics.stderr).not.toContain('old-marker');
    expect(diagnostics.stdout.length).toBeLessThanOrEqual(4000);
    expect(diagnostics.stderr.length).toBeLessThanOrEqual(4000);
    expect(diagnostics.stdout).toContain('[truncated]');
  });
});
