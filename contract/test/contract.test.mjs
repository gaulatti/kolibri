import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cp, mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { sha256, validateContract } from '../src/contract.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const invalid = async (name) => JSON.parse(await readFile(join(root, 'fixtures', 'invalid', name), 'utf8'));

test('build is byte-identical and the release validates from a clean consumer directory', async () => {
  execFileSync(process.execPath, ['src/build.mjs'], { cwd: root });
  const first = await readFile(join(root, 'releases/0.1.0/manifest.json'));
  execFileSync(process.execPath, ['src/build.mjs'], { cwd: root });
  const second = await readFile(join(root, 'releases/0.1.0/manifest.json'));
  assert.equal(sha256(first), sha256(second));
  const consumer = await mkdtemp(join(tmpdir(), 'kolibri-consumer-'));
  await cp(join(root, 'releases/0.1.0'), consumer, { recursive: true });
  const output = execFileSync(process.execPath, [join(consumer, 'bin/validate.mjs'), consumer], { encoding: 'utf8' });
  assert.match(output, /validated Kolibri neutral contract 0\.1\.0/);
});

test('rejects missing references and duplicate identifiers', async () => {
  const missingReference = await invalid('missing-reference.json');
  const duplicateIdentifiers = await invalid('duplicate-identifiers.json');
  assert.throws(() => validateContract(missingReference), /missing component reference: unknown/);
  assert.throws(() => validateContract(duplicateIdentifiers), /duplicate identifier: button/);
  assert.throws(
    () => execFileSync(process.execPath, [join(root, 'releases/0.1.0/bin/validate.mjs'), join(root, 'releases/0.1.0'), join(root, 'fixtures/invalid/missing-reference.json')], { encoding: 'utf8', stdio: 'pipe' }),
    /missing component reference: unknown/,
  );
});

test('rejects unsupported behavior keys and incompatible schema versions', async () => {
  const unsupportedBehavior = await invalid('unsupported-behavior-key.json');
  const incompatibleSchema = await invalid('incompatible-schema-version.json');
  assert.throws(() => validateContract(unsupportedBehavior), /unsupported key: delay/);
  assert.throws(() => validateContract(incompatibleSchema), /incompatible schema version: 2\.0\.0/);
});

test('preserves declared sequential behavior order in the golden release', async () => {
  execFileSync(process.execPath, ['src/build.mjs'], { cwd: root });
  const fixture = JSON.parse(await readFile(join(root, 'releases/0.1.0/fixtures/sequential-behavior.json'), 'utf8'));
  assert.deepEqual(fixture.components[0].behaviors[0].steps.map(({ order, actionId }) => [order, actionId]), [[1, 'set-open'], [2, 'focus-panel']]);
});
