#!/usr/bin/env node
import "dotenv/config";
import { SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import {
  INFRASTRUCTURE_REGION,
  INFRASTRUCTURE_STACK_NAME,
} from "../lib/stack-identity";
import { ensureSystemSecretDefaults } from "../lib/system-secret-defaults";

const secretId = `${INFRASTRUCTURE_STACK_NAME}/system`;

async function main(): Promise<void> {
  const result = await ensureSystemSecretDefaults(
    new SecretsManagerClient({ region: INFRASTRUCTURE_REGION }),
    secretId,
  );

  console.log(
    result === "initialized"
      ? `Initialized defaults in ${secretId}.`
      : `${secretId} already contains the required defaults.`,
  );
}

void main().catch(() => {
  console.error(`Could not initialize defaults in ${secretId}.`);
  process.exitCode = 1;
});
