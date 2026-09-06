import type { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialPersistenceSchema1785600000000 implements MigrationInterface {
  name = 'InitialPersistenceSchema1785600000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
    await queryRunner.query(
      `CREATE TYPE "generation_run_status_enum" AS ENUM ('pending', 'running', 'succeeded', 'failed')`,
    );
    await queryRunner.query(`
      CREATE TABLE "user_references" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "cognito_sub" varchar(128) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_references" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_user_references_cognito_sub" ON "user_references" ("cognito_sub")`,
    );
    await queryRunner.query(`
      CREATE TABLE "design_systems" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "owner_id" uuid NOT NULL,
        "name" varchar(200) NOT NULL,
        "figma_file_key" varchar(255) NOT NULL,
        "package_name" varchar(214) NOT NULL,
        "package_version" varchar(64) NOT NULL,
        "secret_reference" varchar(1024),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_design_systems" PRIMARY KEY ("id"),
        CONSTRAINT "FK_design_systems_owner" FOREIGN KEY ("owner_id")
          REFERENCES "user_references"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_design_systems_owner_id" ON "design_systems" ("owner_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_design_systems_owner_name" ON "design_systems" ("owner_id", "name")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_design_systems_figma_file_key" ON "design_systems" ("figma_file_key")`,
    );
    await queryRunner.query(`
      CREATE TABLE "generation_runs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "design_system_id" uuid NOT NULL,
        "status" "generation_run_status_enum" NOT NULL DEFAULT 'pending',
        "started_at" timestamptz,
        "completed_at" timestamptz,
        "artifact_count" integer NOT NULL DEFAULT 0,
        "token_count" integer NOT NULL DEFAULT 0,
        "component_count" integer NOT NULL DEFAULT 0,
        "warning_count" integer NOT NULL DEFAULT 0,
        "error_count" integer NOT NULL DEFAULT 0,
        "artifact_reference" varchar(1024),
        "failure_summary" varchar(1000),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_generation_runs" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_generation_runs_nonnegative_counts" CHECK (
          "artifact_count" >= 0 AND "token_count" >= 0 AND
          "component_count" >= 0 AND "warning_count" >= 0 AND
          "error_count" >= 0
        ),
        CONSTRAINT "FK_generation_runs_design_system" FOREIGN KEY ("design_system_id")
          REFERENCES "design_systems"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_generation_runs_design_system_id" ON "generation_runs" ("design_system_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_generation_runs_design_system_created" ON "generation_runs" ("design_system_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_generation_runs_status" ON "generation_runs" ("status")`,
    );
    await queryRunner.query(`
      CREATE TABLE "generation_events" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "generation_run_id" uuid NOT NULL,
        "event_type" varchar(100) NOT NULL,
        "message" varchar(1000) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_generation_events" PRIMARY KEY ("id"),
        CONSTRAINT "FK_generation_events_generation_run" FOREIGN KEY ("generation_run_id")
          REFERENCES "generation_runs"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_generation_events_run_created" ON "generation_events" ("generation_run_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_generation_events_event_type" ON "generation_events" ("event_type")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "generation_events"`);
    await queryRunner.query(`DROP TABLE "generation_runs"`);
    await queryRunner.query(`DROP TABLE "design_systems"`);
    await queryRunner.query(`DROP TABLE "user_references"`);
    await queryRunner.query(`DROP TYPE "generation_run_status_enum"`);
  }
}
