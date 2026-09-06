import type { Relation } from 'typeorm';
import {
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  Column,
} from 'typeorm';
import { DesignSystem } from './design-system.entity';
import { DATE_COLUMN_TYPE } from './date-column-type';

@Entity({ name: 'user_references' })
@Index('UQ_user_references_cognito_sub', ['cognitoSub'], { unique: true })
export class UserReference {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'cognito_sub', type: 'varchar', length: 128 })
  cognitoSub!: string;

  @CreateDateColumn({ name: 'created_at', type: DATE_COLUMN_TYPE })
  createdAt!: Date;

  @OneToMany(() => DesignSystem, (designSystem) => designSystem.owner)
  designSystems!: Relation<DesignSystem[]>;
}
