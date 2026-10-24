jest.mock('sql.js', () => ({ __esModule: true, default: jest.fn() }));

import { GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import initSqlJs, { type SqlJsStatic } from 'sql.js';
import { LocalRuntimeConfigurationClient } from './local-runtime-configuration.client';

describe('local configuration read integrity boundary', () => {
  let directory: string;
  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'kolibri-configuration-read-'));
  });
  afterEach(async () => rm(directory, { recursive: true, force: true }));

  it.each([
    { rows: [] },
    { rows: [{ values: [] }] },
    { rows: [{ values: [[null]] }] },
  ])(
    'exposes empty configuration when the database returns no configuration value %#',
    async ({ rows }) => {
      // The real SQLite round-trip suite covers normal persistence. This fault
      // injection checks a missing read result at the database driver boundary;
      // no production code or coverage counters are replaced.
      const exec = jest.fn().mockReturnValue(rows);
      class DatabaseFixture {
        exec = exec;
        run = jest.fn();
        export = () => new Uint8Array();
      }
      jest
        .mocked(initSqlJs)
        .mockResolvedValue({
          Database: DatabaseFixture,
        } as unknown as SqlJsStatic);
      const client = new LocalRuntimeConfigurationClient(
        join(directory, 'configuration.sqlite'),
      );
      await expect(
        client.send(
          new GetSecretValueCommand({ SecretId: 'fixture-local/system' }),
        ),
      ).resolves.toEqual({ SecretString: '{}' });
      expect(exec).toHaveBeenCalledWith(
        'SELECT "configuration" FROM "runtime_configuration" WHERE "id" = 1',
      );
    },
  );
});
