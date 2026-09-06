import {
  GetSecretValueCommand,
  PutSecretValueCommand,
  type SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";

export const DEFAULT_NPM_REGISTRY = "https://registry.npmjs.org";

export async function ensureSystemSecretDefaults(
  client: Pick<SecretsManagerClient, "send">,
  secretId: string,
): Promise<"initialized" | "unchanged"> {
  const configuration = await readConfiguration(client, secretId);
  const npm = objectValue(configuration.npm);
  if (typeof npm.registry === "string" && npm.registry.trim()) {
    return "unchanged";
  }

  await client.send(
    new PutSecretValueCommand({
      SecretId: secretId,
      SecretString: JSON.stringify({
        ...configuration,
        npm: {
          ...npm,
          registry: DEFAULT_NPM_REGISTRY,
        },
      }),
    }),
  );
  return "initialized";
}

async function readConfiguration(
  client: Pick<SecretsManagerClient, "send">,
  secretId: string,
): Promise<Record<string, unknown>> {
  try {
    const response = await client.send(
      new GetSecretValueCommand({ SecretId: secretId }),
    );
    if (!response.SecretString?.trim()) return {};
    const value = JSON.parse(response.SecretString) as unknown;
    if (!isObject(value)) throw new Error("System secret must be a JSON object");
    return value;
  } catch (error) {
    if (isMissingSecretVersion(error)) return {};
    throw error;
  }
}

function isMissingSecretVersion(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "ResourceNotFoundException"
  );
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function objectValue(value: unknown): Record<string, unknown> {
  return isObject(value) ? value : {};
}
