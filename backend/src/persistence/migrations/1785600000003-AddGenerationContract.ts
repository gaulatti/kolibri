import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGenerationContract1785600000003 implements MigrationInterface {
  name = 'AddGenerationContract1785600000003';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "design_systems" ADD "generation_contract" varchar(32) NOT NULL DEFAULT 'legacy'`,
    );
    await queryRunner.query(
      `ALTER TABLE "design_systems" ADD CONSTRAINT "CHK_design_systems_generation_contract" CHECK ("generation_contract" IN ('legacy', 'composable-v1'))`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "design_systems" DROP CONSTRAINT "CHK_design_systems_generation_contract"`,
    );
    await queryRunner.query(
      `ALTER TABLE "design_systems" DROP COLUMN "generation_contract"`,
    );
  }
}
