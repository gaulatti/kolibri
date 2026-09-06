import {
  GetSecretValueCommand,
  PutSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import initSqlJs, { type Database } from 'sql.js';

export class LocalRuntimeConfigurationClient {
  private static readonly databases = new Map<string, Promise<Database>>();

  constructor(
    private readonly filename = 'data/runtime-configuration.sqlite',
    private readonly initialConfiguration = '{}',
  ) {}

  async send(
    command: GetSecretValueCommand | PutSecretValueCommand,
  ): Promise<{ SecretString?: string }> {
    const database = await this.getDatabase();
    if (command instanceof GetSecretValueCommand) {
      const result = database.exec(
        `SELECT "configuration" FROM "runtime_configuration" WHERE "id" = 1`,
      );
      return {
        SecretString: String(result[0]?.values[0]?.[0] ?? '{}'),
      };
    }
    if (command instanceof PutSecretValueCommand) {
      const configuration = command.input.SecretString;
      if (typeof configuration !== 'string') {
        throw new Error('Local runtime configuration must be JSON');
      }
      database.run(
        `INSERT INTO "runtime_configuration" ("id", "configuration")
         VALUES (1, ?)
         ON CONFLICT("id") DO UPDATE SET "configuration" = excluded."configuration"`,
        [configuration],
      );
      await this.persist(database);
      return {};
    }
    throw new Error('Unsupported local runtime configuration operation');
  }

  private getDatabase(): Promise<Database> {
    const existing = LocalRuntimeConfigurationClient.databases.get(
      this.filename,
    );
    if (existing) return existing;
    const database = this.open();
    LocalRuntimeConfigurationClient.databases.set(this.filename, database);
    return database;
  }

  private async open(): Promise<Database> {
    const SQL = await initSqlJs();
    let database: Database;
    try {
      database = new SQL.Database(await readFile(this.filename));
    } catch (error) {
      if (!isMissingFile(error)) throw error;
      database = new SQL.Database();
    }
    database.run(`
      CREATE TABLE IF NOT EXISTS "runtime_configuration" (
        "id" integer NOT NULL PRIMARY KEY CHECK ("id" = 1),
        "configuration" text NOT NULL
      )
    `);
    database.run(
      `INSERT OR IGNORE INTO "runtime_configuration" ("id", "configuration") VALUES (1, ?)`,
      [this.initialConfiguration],
    );
    await this.persist(database);
    return database;
  }

  private async persist(database: Database): Promise<void> {
    await mkdir(dirname(this.filename), { recursive: true });
    const temporaryFilename = `${this.filename}.tmp`;
    await writeFile(temporaryFilename, database.export());
    await rename(temporaryFilename, this.filename);
  }
}

function isMissingFile(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ENOENT'
  );
}
