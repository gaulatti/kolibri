import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NpmProcessError, SpawnNpmProcessRunner } from './npm-process.runner';

describe('SpawnNpmProcessRunner', () => {
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'kolibri-npm-runner-'));
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('captures actionable failure output while redacting credentials', async () => {
    const token = 'npm_sensitive-token-value-123456';
    await writeFile(
      join(directory, 'package.json'),
      JSON.stringify({
        name: 'runner-test',
        version: '1.0.0',
        scripts: {
          fail: `node -e "process.stderr.write('npm ERR! code E403\\n_authToken=${token}\\n'); process.exit(7)"`,
        },
      }),
    );
    const runner = new SpawnNpmProcessRunner();

    let failure: unknown;
    try {
      await runner.run(directory, ['run', 'fail']);
    } catch (error) {
      failure = error;
    }

    expect(failure).toBeInstanceOf(NpmProcessError);
    expect(failure).toMatchObject({
      command: 'npm run fail',
      exitCode: 7,
    });
    expect((failure as NpmProcessError).stderr).toContain('E403');
    expect(JSON.stringify(failure)).not.toContain(token);
  });

  it('maps a process spawn failure', async () => {
    const previousPath = process.env.PATH;
    process.env.PATH = '';
    try {
      await expect(
        new SpawnNpmProcessRunner().run(directory, ['--version']),
      ).rejects.toMatchObject({
        name: 'NpmProcessError',
        command: 'npm --version',
        exitCode: undefined,
      });
    } finally {
      process.env.PATH = previousPath;
    }
  });

  it('resolves a successful npm process', async () => {
    await expect(
      new SpawnNpmProcessRunner().run(directory, ['--version']),
    ).resolves.toBeUndefined();
  });

  it('reports the terminating signal when npm is killed', async () => {
    await writeFile(
      join(directory, 'package.json'),
      JSON.stringify({
        name: 'runner-test',
        version: '1.0.0',
        scripts: { die: 'node -e "process.kill(process.ppid, 9)"' },
      }),
    );
    let failure: unknown;
    try {
      await new SpawnNpmProcessRunner().run(directory, ['run', 'die']);
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(NpmProcessError);
    expect((failure as NpmProcessError).signal).toBeDefined();
    expect((failure as NpmProcessError).exitCode).toBeUndefined();
    expect((failure as NpmProcessError).message).toContain('after signal');
  });

  it('discards the oldest output of a noisy process beyond the bound', async () => {
    await writeFile(
      join(directory, 'package.json'),
      JSON.stringify({
        name: 'runner-test',
        version: '1.0.0',
        scripts: {
          noisy:
            "node -e \"process.stderr.write('HEAD-MARKER' + 'a'.repeat(20000)); process.exit(1)\"",
        },
      }),
    );
    let failure: unknown;
    try {
      await new SpawnNpmProcessRunner().run(directory, ['run', 'noisy']);
    } catch (error) {
      failure = error;
    }
    const stderr = (failure as NpmProcessError).stderr ?? '';
    expect(stderr).not.toContain('HEAD-MARKER');
    expect(stderr.length).toBeGreaterThan(0);
  });
});
