import { DataSource } from 'typeorm';
import { GenerationRunStatus } from './entities';
import { loadDatabaseOptions } from './database.config';

class MetadataDataSource extends DataSource {
  buildEntityMetadata(): Promise<void> {
    return this.buildMetadatas();
  }
}

const environment: NodeJS.ProcessEnv = {
  DATABASE_HOST: 'localhost',
  DATABASE_NAME: 'metadata_only',
  DATABASE_USER: 'metadata_only',
  DATABASE_PASSWORD: 'test-placeholder-not-a-secret',
};

describe('persistence entity metadata', () => {
  let dataSource: MetadataDataSource;

  beforeAll(async () => {
    dataSource = new MetadataDataSource(loadDatabaseOptions(environment));
    await dataSource.buildEntityMetadata();
  });

  it('defines the four foundational tables and minimal user reference', () => {
    expect(
      dataSource.entityMetadatas.map((metadata) => metadata.tableName),
    ).toEqual(
      expect.arrayContaining([
        'user_references',
        'design_systems',
        'generation_runs',
        'generation_events',
      ]),
    );

    const user = dataSource.getMetadata('UserReference');
    expect(user.columns.map((column) => column.databaseName)).toEqual([
      'id',
      'cognito_sub',
      'created_at',
    ]);
    expect(user.indices.find((index) => index.isUnique)).toBeDefined();
  });

  it('defines cascading ownership and generation relationships', () => {
    const designSystem = dataSource.getMetadata('DesignSystem');
    const generationRun = dataSource.getMetadata('GenerationRun');
    const generationEvent = dataSource.getMetadata('GenerationEvent');

    expect(
      designSystem.relations.find(
        (relation) => relation.propertyName === 'owner',
      ),
    ).toMatchObject({ onDelete: 'CASCADE', isNullable: false });
    expect(
      generationRun.relations.find(
        (relation) => relation.propertyName === 'designSystem',
      ),
    ).toMatchObject({ onDelete: 'CASCADE', isNullable: false });
    expect(
      generationEvent.relations.find(
        (relation) => relation.propertyName === 'generationRun',
      ),
    ).toMatchObject({ onDelete: 'CASCADE', isNullable: false });
  });

  it('defines indexes for owner and generation-history lookups', () => {
    expect(
      dataSource.getMetadata('DesignSystem').indices.map((index) => index.name),
    ).toEqual(
      expect.arrayContaining([
        'IDX_design_systems_owner_id',
        'IDX_design_systems_owner_name',
      ]),
    );
    expect(
      dataSource
        .getMetadata('GenerationRun')
        .indices.map((index) => index.name),
    ).toEqual(
      expect.arrayContaining([
        'IDX_generation_runs_design_system_id',
        'IDX_generation_runs_design_system_created',
        'IDX_generation_runs_status',
      ]),
    );
    expect(
      dataSource
        .getMetadata('GenerationEvent')
        .indices.map((index) => index.name),
    ).toEqual(
      expect.arrayContaining([
        'IDX_generation_events_run_created',
        'IDX_generation_events_event_type',
      ]),
    );
  });

  it('does not persist authentication credentials or unnecessary profile data', () => {
    const databaseColumns = dataSource.entityMetadatas
      .flatMap((metadata) => metadata.columns)
      .map((column) => column.databaseName)
      .join(' ');

    expect(databaseColumns).not.toMatch(
      /password|google_token|access_token|refresh_token|secret_value|email|profile/i,
    );
  });

  it('keeps runtime configuration out of design systems and snapshots package identity on runs', () => {
    const designSystemColumns = dataSource
      .getMetadata('DesignSystem')
      .columns.map((column) => column.databaseName);
    const generationRunColumns = dataSource
      .getMetadata('GenerationRun')
      .columns.map((column) => column.databaseName);

    expect(designSystemColumns).toEqual([
      'id',
      'owner_id',
      'name',
      'description',
      'generation_contract',
      'last_published_version',
      'created_at',
      'updated_at',
    ]);
    expect(designSystemColumns).not.toEqual(
      expect.arrayContaining([
        'figma_file_key',
        'package_name',
        'package_version',
        'generation_contract',
        'secret_reference',
      ]),
    );
    expect(generationRunColumns).toEqual(
      expect.arrayContaining([
        'package_name',
        'package_version',
        'publish_requested',
        'published_at',
        'publication_failure_summary',
      ]),
    );
  });

  it('defines safe generation status and count metadata', () => {
    const generationRun = dataSource.getMetadata('GenerationRun');
    const status = generationRun.columns.find(
      (column) => column.propertyName === 'status',
    );

    expect(status?.enum).toEqual(Object.values(GenerationRunStatus));
    expect(status?.default).toBe(GenerationRunStatus.PENDING);
    expect(generationRun.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'CHK_generation_runs_nonnegative_counts',
        }),
      ]),
    );
  });
});
