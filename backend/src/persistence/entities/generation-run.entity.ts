import type { Relation } from 'typeorm';
import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DesignSystem } from './design-system.entity';
import { GenerationEvent } from './generation-event.entity';
import { GenerationRunStatus } from './generation-run-status.enum';
import { DATE_COLUMN_TYPE } from './date-column-type';

@Entity({ name: 'generation_runs' })
@Index('IDX_generation_runs_design_system_id', ['designSystemId'])
@Index('IDX_generation_runs_design_system_created', [
  'designSystemId',
  'createdAt',
])
@Index('IDX_generation_runs_status', ['status'])
@Check(
  'CHK_generation_runs_nonnegative_counts',
  '"artifact_count" >= 0 AND "token_count" >= 0 AND "component_count" >= 0 AND "warning_count" >= 0 AND "error_count" >= 0',
)
@Check(
  'CHK_generation_runs_generation_contract',
  `"generation_contract" IN ('legacy', 'composable-v1')`,
)
export class GenerationRun {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'design_system_id' })
  designSystemId!: string;

  @ManyToOne(
    () => DesignSystem,
    (designSystem) => designSystem.generationRuns,
    {
      nullable: false,
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({
    name: 'design_system_id',
    foreignKeyConstraintName: 'FK_generation_runs_design_system',
  })
  designSystem!: Relation<DesignSystem>;

  @Column({
    type: 'simple-enum',
    enum: GenerationRunStatus,
    enumName: 'generation_run_status_enum',
    default: GenerationRunStatus.PENDING,
  })
  status!: GenerationRunStatus;

  @Column({ name: 'started_at', type: DATE_COLUMN_TYPE, nullable: true })
  startedAt!: Date | null;

  @Column({ name: 'completed_at', type: DATE_COLUMN_TYPE, nullable: true })
  completedAt!: Date | null;

  @Column({ name: 'package_name', type: 'varchar', length: 214 })
  packageName!: string;

  @Column({ name: 'package_version', type: 'varchar', length: 64 })
  packageVersion!: string;

  @Column({
    name: 'generation_contract',
    type: 'varchar',
    length: 32,
    default: 'legacy',
  })
  generationContract!: 'legacy' | 'composable-v1';

  @Column({ name: 'publish_requested', type: 'boolean', default: false })
  publishRequested!: boolean;

  @Column({ name: 'published_at', type: DATE_COLUMN_TYPE, nullable: true })
  publishedAt!: Date | null;

  @Column({
    name: 'publication_failure_summary',
    type: 'varchar',
    length: 1000,
    nullable: true,
  })
  publicationFailureSummary!: string | null;

  @Column({ name: 'artifact_count', type: 'integer', default: 0 })
  artifactCount!: number;

  @Column({ name: 'token_count', type: 'integer', default: 0 })
  tokenCount!: number;

  @Column({ name: 'component_count', type: 'integer', default: 0 })
  componentCount!: number;

  @Column({ name: 'warning_count', type: 'integer', default: 0 })
  warningCount!: number;

  @Column({ name: 'error_count', type: 'integer', default: 0 })
  errorCount!: number;

  @Column({
    name: 'artifact_reference',
    type: 'varchar',
    length: 1024,
    nullable: true,
  })
  artifactReference!: string | null;

  @Column({
    name: 'failure_summary',
    type: 'varchar',
    length: 1000,
    nullable: true,
  })
  // Callers must store a sanitized, user-displayable summary, not raw logs.
  failureSummary!: string | null;

  @CreateDateColumn({ name: 'created_at', type: DATE_COLUMN_TYPE })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: DATE_COLUMN_TYPE })
  updatedAt!: Date;

  @OneToMany(() => GenerationEvent, (event) => event.generationRun)
  events!: Relation<GenerationEvent[]>;
}
