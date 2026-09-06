import type { MigrationInterface, QueryRunner } from 'typeorm';

export class SeparateDesignSystemRuntimeConfiguration1785600000001 implements MigrationInterface {
  name = 'SeparateDesignSystemRuntimeConfiguration1785600000001';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "design_systems" ADD "description" varchar(1000)`,
    );
    await queryRunner.query(
      `ALTER TABLE "generation_runs" ADD "package_name" varchar(214)`,
    );
    await queryRunner.query(
      `ALTER TABLE "generation_runs" ADD "package_version" varchar(64)`,
    );
    await queryRunner.query(`
      UPDATE "generation_runs" AS run
      SET
        "package_name" = design_system."package_name",
        "package_version" = design_system."package_version"
      FROM "design_systems" AS design_system
      WHERE design_system."id" = run."design_system_id"
    `);
    await queryRunner.query(
      `ALTER TABLE "generation_runs" ALTER COLUMN "package_name" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "generation_runs" ALTER COLUMN "package_version" SET NOT NULL`,
    );
    await queryRunner.query(`DROP INDEX "IDX_design_systems_figma_file_key"`);
    await queryRunner.query(
      `ALTER TABLE "design_systems" DROP COLUMN "figma_file_key"`,
    );
    await queryRunner.query(
      `ALTER TABLE "design_systems" DROP COLUMN "package_name"`,
    );
    await queryRunner.query(
      `ALTER TABLE "design_systems" DROP COLUMN "package_version"`,
    );
    await queryRunner.query(
      `ALTER TABLE "design_systems" DROP COLUMN "secret_reference"`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "design_systems" ADD "figma_file_key" varchar(255) NOT NULL DEFAULT ''`,
    );
    await queryRunner.query(
      `ALTER TABLE "design_systems" ADD "package_name" varchar(214) NOT NULL DEFAULT ''`,
    );
    await queryRunner.query(
      `ALTER TABLE "design_systems" ADD "package_version" varchar(64) NOT NULL DEFAULT '0.0.0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "design_systems" ADD "secret_reference" varchar(1024)`,
    );
    await queryRunner.query(`
      UPDATE "design_systems" AS design_system
      SET
        "package_name" = COALESCE((
          SELECT run."package_name"
          FROM "generation_runs" AS run
          WHERE run."design_system_id" = design_system."id"
          ORDER BY run."created_at" DESC, run."id" DESC
          LIMIT 1
        ), ''),
        "package_version" = COALESCE((
          SELECT run."package_version"
          FROM "generation_runs" AS run
          WHERE run."design_system_id" = design_system."id"
          ORDER BY run."created_at" DESC, run."id" DESC
          LIMIT 1
        ), '0.0.0')
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_design_systems_figma_file_key" ON "design_systems" ("figma_file_key")`,
    );
    await queryRunner.query(
      `ALTER TABLE "generation_runs" DROP COLUMN "package_version"`,
    );
    await queryRunner.query(
      `ALTER TABLE "generation_runs" DROP COLUMN "package_name"`,
    );
    await queryRunner.query(
      `ALTER TABLE "design_systems" DROP COLUMN "description"`,
    );
  }
}
