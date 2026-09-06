import type { Relation } from 'typeorm';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { GenerationRun } from './generation-run.entity';
import { DATE_COLUMN_TYPE } from './date-column-type';

@Entity({ name: 'generation_events' })
@Index('IDX_generation_events_run_created', ['generationRunId', 'createdAt'])
@Index('IDX_generation_events_event_type', ['eventType'])
export class GenerationEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'generation_run_id' })
  generationRunId!: string;

  @ManyToOne(() => GenerationRun, (run) => run.events, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'generation_run_id',
    foreignKeyConstraintName: 'FK_generation_events_generation_run',
  })
  generationRun!: Relation<GenerationRun>;

  @Column({ name: 'event_type', type: 'varchar', length: 100 })
  eventType!: string;

  @Column({ type: 'varchar', length: 1000 })
  // Callers must store a safe user-facing event message, not raw diagnostics.
  message!: string;

  @CreateDateColumn({ name: 'created_at', type: DATE_COLUMN_TYPE })
  createdAt!: Date;
}
