import { Injectable } from '@nestjs/common';
import { spawn } from 'node:child_process';
import { sanitizeLogText } from '../observability/safe-error';

export type NpmProcessRunner = {
  run(cwd: string, args: string[]): Promise<void>;
};

export class NpmProcessError extends Error {
  override readonly name = 'NpmProcessError';

  constructor(
    readonly command: string,
    readonly exitCode: number | undefined,
    readonly signal: string | undefined,
    readonly stdout: string | undefined,
    readonly stderr: string | undefined,
    options?: ErrorOptions,
  ) {
    super(
      `${command} failed${
        exitCode === undefined ? '' : ` with exit code ${exitCode}`
      }${signal ? ` after signal ${signal}` : ''}`,
      options,
    );
  }
}

@Injectable()
export class SpawnNpmProcessRunner implements NpmProcessRunner {
  run(cwd: string, args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const command = `npm ${args.slice(0, 2).join(' ')}`.trim();
      const child = spawn('npm', args, {
        cwd,
        env: {
          ...globalThis.process.env,
          npm_config_update_notifier: 'false',
        },
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let stdout = '';
      let stderr = '';
      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');
      child.stdout.on('data', (chunk: string) => {
        stdout = appendBounded(stdout, chunk);
      });
      child.stderr.on('data', (chunk: string) => {
        stderr = appendBounded(stderr, chunk);
      });
      child.once('error', (error) =>
        reject(
          new NpmProcessError(
            command,
            undefined,
            undefined,
            sanitizedOutput(stdout),
            sanitizedOutput(stderr),
            { cause: error },
          ),
        ),
      );
      child.once('exit', (code, signal) => {
        if (code === 0) resolve();
        else
          reject(
            new NpmProcessError(
              command,
              code ?? undefined,
              signal ?? undefined,
              sanitizedOutput(stdout),
              sanitizedOutput(stderr),
            ),
          );
      });
    });
  }
}

const MAX_PROCESS_OUTPUT = 16_000;

function appendBounded(current: string, chunk: string): string {
  const combined = current + chunk;
  return combined.length <= MAX_PROCESS_OUTPUT
    ? combined
    : combined.slice(combined.length - MAX_PROCESS_OUTPUT);
}

function sanitizedOutput(value: string): string | undefined {
  const sanitized = sanitizeLogText(value);
  return sanitized || undefined;
}
