import type { QueryRunner } from 'typeorm';
import { InitialPersistenceSchema1785600000000 } from './1785600000000-InitialPersistenceSchema';
import { SeparateDesignSystemRuntimeConfiguration1785600000001 } from './1785600000001-SeparateDesignSystemRuntimeConfiguration';
import { AddNpmPublicationTracking1785600000002 } from './1785600000002-AddNpmPublicationTracking';
import { AddGenerationContract1785600000003 } from './1785600000003-AddGenerationContract';
import { SnapshotGenerationContract1785600000004 } from './1785600000004-SnapshotGenerationContract';

describe('PostgreSQL migrations', () => {
  it.each([
    new InitialPersistenceSchema1785600000000(),
    new SeparateDesignSystemRuntimeConfiguration1785600000001(),
    new AddNpmPublicationTracking1785600000002(),
    new AddGenerationContract1785600000003(),
    new SnapshotGenerationContract1785600000004(),
  ])('executes every up and down statement for $name', async (migration) => {
    const query = jest
      .fn<Promise<unknown>, [string]>()
      .mockResolvedValue(undefined);
    const runner = { query } as unknown as QueryRunner;

    await migration.up(runner);
    const upStatements = query.mock.calls.map(([statement]) => statement);
    query.mockClear();
    await migration.down(runner);
    const downStatements = query.mock.calls.map(([statement]) => statement);

    expect(upStatements.length).toBeGreaterThan(0);
    expect(downStatements.length).toBeGreaterThan(0);
    expect(upStatements.concat(downStatements)).toEqual(
      expect.arrayContaining([expect.stringContaining('TABLE')]),
    );
  });
});
