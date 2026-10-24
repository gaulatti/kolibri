import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { failureMessage, safeAssetPath } from '../src/conform.mjs';

const proof = dirname(dirname(fileURLToPath(import.meta.url)));
const release = resolve(proof, '../../contract/releases/0.1.0');
const cli = join(proof, 'src/conform.mjs');
const fixture = JSON.parse(await readFile(join(proof, 'fixtures/toggle-family.json'), 'utf8'));

async function withFixture(change, run) {
  const directory = await mkdtemp(join(tmpdir(), 'kolibri-conformance-negative-'));
  try {
    const input = structuredClone(fixture);
    change(input);
    const path = join(directory, 'fixture.json');
    await writeFile(path, JSON.stringify(input));
    await run(path, directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
function invoke(args) {
  return spawnSync(process.execPath, [cli, ...(args.includes('--release') ? [] : ['--release', release]), ...args], { cwd: proof, encoding: 'utf8' });
}

test('missing CLI option values fail with a bounded actionable diagnostic', () => {
  const result = invoke(['--fixture']);
  assert.equal(result.status, 1);
  assert.equal(result.stderr, 'FAIL --fixture requires a path\n');
  assert.equal(result.stdout, '');
});
test('asset path validation contains both parent and sibling escapes', () => {
  const root = resolve(tmpdir(), 'kolibri-assets');
  assert.equal(safeAssetPath(root, 'icons/bold.svg'), join(root, 'icons/bold.svg'));
  for (const uri of ['..', '../outside.svg', '../../sibling/file.svg']) {
    assert.throws(() => safeAssetPath(root, uri), /escapes the conformance fixture root/);
  }
});
test('missing metadata reports the supported schema instead of inventing compatibility', async () => {
  await withFixture((input) => { delete input.metadata; }, (path) => {
    const result = invoke(['--fixture', path]);
    assert.equal(result.status, 1);
    assert.equal(result.stderr, 'FAIL $.metadata.schemaVersion=<missing>; supported=1.0.0; release=0.1.0\n');
  });
});
test('a schema-compatible but invalid fixture preserves the immutable validator diagnostic', async () => {
  await withFixture((input) => { input.entrypoints = ['missing-component']; }, (path) => {
    const result = invoke(['--fixture', path]);
    assert.equal(result.status, 1);
    assert.equal(result.stderr, 'FAIL immutable release validator rejected the fixture: missing component reference: missing-component\n');
    assert.equal(result.stdout, '');
  });
});
test('unavailable validator diagnostics cannot be mistaken for conformance', async () => {
  await withFixture(() => {}, async (path, directory) => {
    const simulated = join(directory, 'release');
    await cp(release, simulated, { recursive: true });
    await writeFile(join(simulated, 'bin/validate.mjs'), 'process.exitCode = 1;\n');
    const result = invoke(['--release', simulated, '--fixture', path]);
    assert.equal(result.status, 1);
    assert.equal(result.stderr, 'FAIL immutable release validator rejected the fixture: unknown validation failure\n');
  });
});
test('optional variant metadata cannot silently change the checked-in semantic result', async () => {
  await withFixture((input) => { delete input.components[0].tree[0].props.variants; }, (path) => {
    const result = invoke(['--fixture', path]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /semantic projection differs/);
  });
});
test('failure formatting preserves an existing FAIL prefix and handles non-Error rejection values', () => {
  assert.equal(failureMessage(new Error('FAIL fixture mismatch')), 'FAIL fixture mismatch');
  assert.equal(failureMessage(new Error('asset missing')), 'FAIL asset missing');
  assert.equal(failureMessage('unexpected rejection'), 'FAIL unexpected rejection');
});
test('programmatic module import does not execute the conformance CLI', () => {
  const url = new URL('../src/conform.mjs', import.meta.url).href;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `const module = await import(${JSON.stringify(url)}); console.log(module.failureMessage('fixture'));`], { encoding: 'utf8' });
  assert.equal(result.status, 0);
  assert.equal(result.stdout, 'FAIL fixture\n');
  assert.equal(result.stderr, '');
});
test('a programmatic module consumer may have a non-file argument', () => {
  const url = new URL('../src/conform.mjs', import.meta.url).href;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `const module = await import(${JSON.stringify(url)}); console.log(module.failureMessage('fixture'));`, 'fixture-not-a-file'], { encoding: 'utf8' });
  assert.equal(result.status, 0);
  assert.equal(result.stdout, 'FAIL fixture\n');
  assert.equal(result.stderr, '');
});
