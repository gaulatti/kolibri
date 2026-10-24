import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const proofRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const repositoryRoot = dirname(dirname(proofRoot));
const release = join(repositoryRoot, 'contract/releases/0.1.0');
const cli = join(proofRoot, 'src/conform.mjs');

function run(args = [], options = {}) {
  return execFileSync(process.execPath, [cli, '--release', release, ...args], {
    cwd: proofRoot,
    encoding: 'utf8',
    ...options,
  });
}

test('emits deterministic CI-suitable conformance evidence', () => {
  const first = run();
  const second = run();
  assert.equal(first, second);
  assert.match(first, /^PASS bleecker-toggle-family conforms to Kolibri 0\.1\.0 schema 1\.0\.0/m);
  assert.match(first, /semantic-output-sha256=[0-9a-f]{64}/);
  assert.match(first, /portable=6 consumer-owned=6/);
});

test('runs as a black-box consumer with only the immutable release and proof files', async () => {
  const cleanRoot = await mkdtemp(join(tmpdir(), 'kolibri-toggle-consumer-'));
  const cleanRelease = join(cleanRoot, 'release');
  const cleanProof = join(cleanRoot, 'proof');
  try {
    await cp(release, cleanRelease, { recursive: true });
    await mkdir(cleanProof);
    for (const name of ['src', 'assets', 'fixtures', 'expected', 'contract-pin.json', 'package.json']) {
      await cp(join(proofRoot, name), join(cleanProof, name), { recursive: true });
    }
    const output = execFileSync(process.execPath, [join(cleanProof, 'src/conform.mjs'), '--release', cleanRelease], {
      cwd: cleanRoot,
      encoding: 'utf8',
    });
    assert.match(output, /^PASS bleecker-toggle-family/m);
  } finally {
    await rm(cleanRoot, { recursive: true, force: true });
  }
});

test('rejects an incompatible fixture with field and supported-version diagnostics', () => {
  const result = spawnSync(
    process.execPath,
    [cli, '--release', release, '--fixture', join(proofRoot, 'fixtures/incompatible-schema-version.json')],
    { cwd: proofRoot, encoding: 'utf8' },
  );
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, 'FAIL $.metadata.schemaVersion=2.0.0; supported=1.0.0; release=0.1.0\n');
});

test('fixture inventory covers variants, state, events, assets, and accessibility', async () => {
  const fixture = JSON.parse(await readFile(join(proofRoot, 'fixtures/toggle-family.json'), 'utf8'));
  const component = fixture.components[0];
  const root = component.tree[0];
  assert.deepEqual(root.props.variants.size, ['sm', 'md', 'lg']);
  assert.deepEqual(root.props.variants.variant, ['default', 'outline']);
  assert.deepEqual(root.props.states.pressed, [false, true]);
  assert.deepEqual(root.props.states.disabled, [false, true]);
  assert.deepEqual(component.events.map(({ name }) => name), ['activate-unpressed', 'activate-pressed', 'focus-request']);
  assert.equal(component.assets[0].kind, 'icon');
  assert.equal(root.props.attributes['aria-label'], 'Bold');
  assert.equal(root.props.attributes['aria-pressed'], false);
});
