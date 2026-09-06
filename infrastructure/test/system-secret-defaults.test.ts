import {
  GetSecretValueCommand,
  PutSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
import { ensureSystemSecretDefaults } from "../lib/system-secret-defaults";

describe("system secret defaults", () => {
  it("initializes an empty secret with the npm registry", async () => {
    const send = jest
      .fn()
      .mockRejectedValueOnce({ name: "ResourceNotFoundException" })
      .mockResolvedValueOnce({});

    await expect(
      ensureSystemSecretDefaults({ send } as never, "InfrastructureStack/system"),
    ).resolves.toBe("initialized");
    expect(send.mock.calls[0][0]).toBeInstanceOf(GetSecretValueCommand);
    const write = send.mock.calls[1][0] as PutSecretValueCommand;
    expect(JSON.parse(write.input.SecretString!)).toEqual({
      npm: { registry: "https://registry.npmjs.org" },
    });
  });

  it("merges the default without replacing existing configuration", async () => {
    const current = {
      postgresql: { host: "database.internal", password: "preserved" },
      storage: { driver: "s3", bucket: "preserved" },
      future: { enabled: true },
    };
    const send = jest
      .fn()
      .mockResolvedValueOnce({ SecretString: JSON.stringify(current) })
      .mockResolvedValueOnce({});

    await ensureSystemSecretDefaults(
      { send } as never,
      "InfrastructureStack/system",
    );

    const write = send.mock.calls[1][0] as PutSecretValueCommand;
    expect(JSON.parse(write.input.SecretString!)).toEqual({
      ...current,
      npm: { registry: "https://registry.npmjs.org" },
    });
  });

  it("does not write when the registry is already configured", async () => {
    const send = jest.fn().mockResolvedValueOnce({
      SecretString: JSON.stringify({
        npm: { registry: "https://registry.example.com" },
      }),
    });

    await expect(
      ensureSystemSecretDefaults({ send } as never, "InfrastructureStack/system"),
    ).resolves.toBe("unchanged");
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("refuses to overwrite malformed secret data", async () => {
    const send = jest
      .fn()
      .mockResolvedValueOnce({ SecretString: "not-json" });

    await expect(
      ensureSystemSecretDefaults({ send } as never, "InfrastructureStack/system"),
    ).rejects.toThrow();
    expect(send).toHaveBeenCalledTimes(1);
  });
});
