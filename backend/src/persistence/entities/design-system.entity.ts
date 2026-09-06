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
import { GenerationRun } from './generation-run.entity';
import { UserReference } from './user-reference.entity';
import { DATE_COLUMN_TYPE } from './date-column-type';

@Entity({ name: 'design_systems' })
@Index('IDX_design_systems_owner_id', ['ownerId'])
@Index('IDX_design_systems_owner_name', ['ownerId', 'name'])
@Check(
  'CHK_design_systems_generation_contract',
  `"generation_contract" IN ('legacy', 'composable-v1')`,
)
export class DesignSystem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'owner_id' })
  ownerId!: string;

  @ManyToOne(() => UserReference, (owner) => owner.designSystems, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'owner_id',
    foreignKeyConstraintName: 'FK_design_systems_owner',
  })
  owner!: Relation<UserReference>;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  description!: string | null;

  @Column({
    name: 'generation_contract',
    type: 'varchar',
    length: 32,
    default: 'legacy',
  })
  generationContract!: 'legacy' | 'composable-v1';

  @Column({
    name: 'last_published_version',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  lastPublishedVersion!: string | null;

  @CreateDateColumn({ name: 'created_at', type: DATE_COLUMN_TYPE })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: DATE_COLUMN_TYPE })
  updatedAt!: Date;

  @OneToMany(() => GenerationRun, (run) => run.designSystem)
  generationRuns!: Relation<GenerationRun[]>;
}
