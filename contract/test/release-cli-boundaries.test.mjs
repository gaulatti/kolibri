import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { sha256 } from "../src/contract.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const released = join(root, "releases/0.1.0");
const loader = (mode) => {
  const url = new URL("./runtime-boundary-loader.mjs", import.meta.url);
  if (mode) url.searchParams.set("mode", mode);
  return url.href;
};
const execute = (entry, args = [], cwd = root, mode) =>
  execFileSync(process.execPath, ["--import", loader(mode), entry, ...args], {
    cwd,
    encoding: "utf8",
    stdio: "pipe",
  });

for (const entry of [
  join(released, "bin/validate.mjs"),
  join(root, "src/release-validator.mjs"),
]) {
  test(`${entry.endsWith("/src/release-validator.mjs") ? "source template" : "immutable release"} validates cwd defaults and a complete consumer document`, async () => {
    assert.match(
      execute(entry, [], released),
      /validated Kolibri neutral contract 0\.1\.0/,
    );
    assert.match(
      execute(entry, [
        released,
        join(released, "fixtures/composed-component.json"),
      ]),
      /1 consumer document/,
    );
  });

  for (const [name, mutate, expected] of [
    [
      "incompatible schema",
      (manifest) => {
        manifest.schemaVersion = "2.0.0";
      },
      /incompatible schema version/,
    ],
    [
      "unsupported compatibility",
      (manifest) => {
        manifest.compatibleSchemaVersions = "*";
      },
      /unsupported compatibility range/,
    ],
    [
      "checksum mismatch",
      (manifest) => {
        manifest.artifacts[0].sha256 = "0".repeat(64);
      },
      /checksum mismatch/,
    ],
    [
      "size mismatch",
      (manifest) => {
        manifest.artifacts[0].bytes += 1;
      },
      /size mismatch/,
    ],
  ]) {
    test(`validator ${entry.includes("/src/") ? "source" : "release"} rejects ${name} before approving the bundle`, async () => {
      const consumer = await mkdtemp(
        join(tmpdir(), "kolibri-contract-negative-"),
      );
      try {
        await cp(released, consumer, { recursive: true });
        const manifest = JSON.parse(
          await readFile(join(consumer, "manifest.json"), "utf8"),
        );
        mutate(manifest);
        await writeFile(
          join(consumer, "manifest.json"),
          JSON.stringify(manifest),
        );
        assert.throws(() => execute(entry, [consumer]), expected);
      } finally {
        await rm(consumer, { recursive: true, force: true });
      }
    });
  }
}

test("build preserves immutable release bytes when schema input has no final newline", async () => {
  const before = await readFile(join(released, "manifest.json"));
  assert.match(
    execute(join(root, "src/build.mjs"), [], root, "schema-without-newline"),
    /built Kolibri neutral contract 0\.1\.0/,
  );
  assert.equal(
    sha256(await readFile(join(released, "manifest.json"))),
    sha256(before),
  );
});

test("determinism verification passes matching builds and rejects unequal manifest reads", () => {
  assert.match(
    execute(join(root, "src/verify-determinism.mjs")),
    /deterministic manifest sha256=/,
  );
  assert.throws(
    () =>
      execute(
        join(root, "src/verify-determinism.mjs"),
        [],
        root,
        "unequal-build-reads",
      ),
    /two clean builds produced different manifests/,
  );
});
