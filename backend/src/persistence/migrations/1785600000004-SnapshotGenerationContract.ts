import type { MigrationInterface, QueryRunner } from 'typeorm';

export class SnapshotGenerationContract1785600000004 implements MigrationInterface {
  name = 'SnapshotGenerationContract1785600000004';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "generation_runs" ADD "generation_contract" varchar(32) NOT NULL DEFAULT 'legacy'`,
    );
    await queryRunner.query(
      `ALTER TABLE "generation_runs" ADD CONSTRAINT "CHK_generation_runs_generation_contract" CHECK ("generation_contract" IN ('legacy', 'composable-v1'))`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "generation_runs" DROP CONSTRAINT "CHK_generation_runs_generation_contract"`,
    );
    await queryRunner.query(
      `ALTER TABLE "generation_runs" DROP COLUMN "generation_contract"`,
    );
  }
}
