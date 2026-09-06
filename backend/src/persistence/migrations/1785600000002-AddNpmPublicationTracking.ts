import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNpmPublicationTracking1785600000002 implements MigrationInterface {
  name = 'AddNpmPublicationTracking1785600000002';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "design_systems" ADD "last_published_version" varchar(64)`,
    );
    await queryRunner.query(
      `ALTER TABLE "generation_runs" ADD "publish_requested" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "generation_runs" ADD "published_at" timestamptz`,
    );
    await queryRunner.query(
      `ALTER TABLE "generation_runs" ADD "publication_failure_summary" varchar(1000)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "generation_runs" DROP COLUMN "publication_failure_summary"`,
    );
    await queryRunner.query(
      `ALTER TABLE "generation_runs" DROP COLUMN "published_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "generation_runs" DROP COLUMN "publish_requested"`,
    );
    await queryRunner.query(
      `ALTER TABLE "design_systems" DROP COLUMN "last_published_version"`,
    );
  }
}
