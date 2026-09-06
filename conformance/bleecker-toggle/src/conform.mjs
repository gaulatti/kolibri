#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const proofRoot = dirname(dirname(fileURLToPath(import.meta.url)));

function argument(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1) return resolve(proofRoot, fallback);
  if (!process.argv[index + 1]) throw new Error(`FAIL ${name} requires a path`);
  return resolve(process.cwd(), process.argv[index + 1]);
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
}

function serialize(value) {
  return `${JSON.stringify(canonicalize(value), null, 2)}\n`;
}

function sha256(content, encoding = 'hex') {
  return createHash('sha256').update(content).digest(encoding);
}

function visit(nodes, callback) {
  for (const node of nodes) {
    callback(node);
    visit(node.children ?? [], callback);
  }
}

function safeAssetPath(assetRoot, uri) {
  const target = resolve(assetRoot, uri);
  const pathFromRoot = relative(assetRoot, target);
  if (isAbsolute(pathFromRoot) || pathFromRoot === '..' || pathFromRoot.startsWith(`..${sep}`)) {
    throw new Error(`FAIL asset ${uri} escapes the conformance fixture root`);
  }
  return target;
}

function failForValidator(fixture, manifest, result) {
  if (fixture.metadata?.schemaVersion !== manifest.schemaVersion) {
    throw new Error(
      `FAIL $.metadata.schemaVersion=${fixture.metadata?.schemaVersion ?? '<missing>'}; supported=${manifest.schemaVersion}; release=${manifest.releaseVersion}`,
    );
  }
  const output = `${result.stderr}\n${result.stdout}`;
  const diagnostic = output.split('\n').find((line) => line.startsWith('Error: '))?.slice('Error: '.length) ?? 'unknown validation failure';
  throw new Error(`FAIL immutable release validator rejected the fixture: ${diagnostic}`);
}

async function projectSemantics({ fixture, manifest, pin, assetRoot, manifestDigest }) {
  assert.equal(fixture.entrypoints.length, 1, 'proof must have exactly one entrypoint');
  const entrypoint = fixture.entrypoints[0];
  const component = fixture.components.find(({ id }) => id === entrypoint);
  assert.ok(component, `entrypoint ${entrypoint} must resolve`);
  assert.equal(component.tree.length, 1, 'toggle family must have one root node');
  const root = component.tree[0];
  assert.equal(root.element, 'button', 'toggle control must be a button');
  assert.equal(root.part, 'control', 'toggle root must expose the control part');
  assert.equal(root.props?.attributes?.type, 'button', 'toggle control must not submit forms');
  assert.equal(typeof root.props?.attributes?.['aria-label'], 'string', 'toggle control must have an accessible name');
  assert.equal(typeof root.props?.attributes?.['aria-pressed'], 'boolean', 'toggle control must expose pressed state');
  assert.equal(typeof root.props?.attributes?.disabled, 'boolean', 'toggle control must expose disabled state');
  assert.deepEqual(root.props?.states?.pressed, [false, true], 'toggle family must declare both pressed states');
  for (const [name, values] of Object.entries(root.props?.variants ?? {})) {
    assert.ok(Array.isArray(values) && values.length > 0, `variant ${name} must declare values`);
    assert.equal(new Set(values).size, values.length, `variant ${name} must not contain duplicates`);
  }

  const assetsById = new Map(component.assets.map((asset) => [asset.id, asset]));
  const assetReferences = [];
  const nodeIds = new Set();
  visit(component.tree, (node) => {
    nodeIds.add(node.id);
    const assetId = node.props?.assetId;
    if (!assetId) return;
    const asset = assetsById.get(assetId);
    assert.ok(asset, `node ${node.id} references missing asset ${assetId}`);
    assetReferences.push({ node: node.id, assetId, kind: asset.kind, uri: asset.uri, integrity: asset.integrity });
  });
  assert.ok(assetReferences.length, 'toggle family must reference at least one asset');
  assert.deepEqual(new Set(assetReferences.map(({ assetId }) => assetId)), new Set(assetsById.keys()), 'every declared asset must be referenced');
  for (const reference of assetReferences) {
    const content = await readFile(safeAssetPath(assetRoot, reference.uri));
    assert.equal(`sha256-${sha256(content, 'base64')}`, reference.integrity, `asset integrity mismatch: ${reference.uri}`);
  }

  const actions = new Map(component.actions.map((action) => [action.id, action]));
  const transitions = [];
  const focusTargets = new Set();
  for (const behavior of component.behaviors) {
    const behaviorActions = behavior.steps.map((step) => actions.get(step.actionId));
    behaviorActions.filter((action) => action?.type === 'focus').forEach((action) => focusTargets.add(action.target));
    const state = behaviorActions.find((action) => action?.type === 'set-state');
    if (!state) continue;
    const emit = behaviorActions.find((action) => action?.type === 'emit');
    assert.ok(emit, `${behavior.id} must emit its state change`);
    assert.equal(emit.value?.value, state.value?.value, `${behavior.id} state and emitted values must match`);
    transitions.push({
      behavior: behavior.id,
      event: behavior.steps[0].event,
      state: state.value?.field,
      value: state.value?.value,
      emit: emit.value?.event,
    });
  }
  transitions.sort((left, right) => left.behavior.localeCompare(right.behavior));
  assert.deepEqual(transitions.map(({ value }) => value).sort(), [false, true], 'toggle fixture must cover both pressed transitions');
  for (const target of focusTargets) assert.ok(nodeIds.has(target), `focus action references missing node ${target}`);

  const contractGuarantees = [
    'accessible name and pressed-state attributes',
    'checksummed asset identity',
    'control element and semantic part names',
    'declared variant and state vocabulary',
    'entrypoint and component identity',
    'ordered state, emit, and focus actions',
  ];
  const consumerOwned = [
    'asset rendering and icon-library substitution',
    'DOM event wiring and disabled-event suppression',
    'focus-ring and keyboard-modality presentation',
    'light/dark theme tokens, sizing, spacing, motion, and responsive layout',
    'React controlled-state API and callback scheduling',
    'screen-reader verification in the target browser or platform',
  ];

  return {
    artifact: {
      releaseVersion: manifest.releaseVersion,
      schemaVersion: manifest.schemaVersion,
      sourceRevision: manifest.sourceRevision,
      manifestSha256: manifestDigest,
      landedCommit: pin.landedCommit,
    },
    family: {
      id: component.id,
      name: component.name,
      kind: component.kind,
      entrypoint,
      variants: root.props.variants,
      states: root.props.states,
    },
    semantics: {
      root: { element: root.element, part: root.part, attributes: root.props.attributes },
      events: component.events.map(({ name }) => name).sort(),
      transitions,
      focusTargets: [...focusTargets].sort(),
      assetReferences: assetReferences.sort((left, right) => left.node.localeCompare(right.node)),
    },
    portability: { contractGuarantees, consumerOwned },
  };
}

async function main() {
  const release = argument('--release', '../../contract/releases/0.1.0');
  const fixturePath = argument('--fixture', 'fixtures/toggle-family.json');
  const expectedPath = argument('--expected', 'expected/semantic-output.json');
  const assetRoot = argument('--asset-root', '.');
  const [manifestContent, fixtureContent, expectedContent, pinContent] = await Promise.all([
    readFile(resolve(release, 'manifest.json')),
    readFile(fixturePath, 'utf8'),
    readFile(expectedPath, 'utf8'),
    readFile(resolve(proofRoot, 'contract-pin.json'), 'utf8'),
  ]);
  const manifest = JSON.parse(manifestContent);
  const fixture = JSON.parse(fixtureContent);
  const expected = JSON.parse(expectedContent);
  const pin = JSON.parse(pinContent);
  const manifestDigest = sha256(manifestContent);

  assert.equal(manifest.releaseVersion, pin.releaseVersion, 'release version differs from the pin');
  assert.equal(manifest.schemaVersion, pin.schemaVersion, 'schema version differs from the pin');
  assert.equal(manifest.sourceRevision, pin.sourceRevision, 'source revision differs from the pin');
  assert.equal(manifestDigest, pin.manifestSha256, 'manifest checksum differs from the pin');

  const validation = spawnSync(process.execPath, [resolve(release, 'bin/validate.mjs'), release, fixturePath], { encoding: 'utf8' });
  if (validation.status !== 0) failForValidator(fixture, manifest, validation);

  const actual = await projectSemantics({ fixture, manifest, pin, assetRoot, manifestDigest });
  assert.deepEqual(canonicalize(actual), canonicalize(expected), 'semantic projection differs from the checked-in expectation');
  const digest = sha256(serialize(actual));
  console.log(`PASS ${actual.family.id} conforms to Kolibri ${manifest.releaseVersion} schema ${manifest.schemaVersion}`);
  console.log(`artifact manifest-sha256=${manifestDigest}`);
  console.log('fixture=fixtures/toggle-family.json');
  console.log(`semantic-output-sha256=${digest}`);
  console.log(`portable=${actual.portability.contractGuarantees.length} consumer-owned=${actual.portability.consumerOwned.length}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message.startsWith('FAIL ') ? message : `FAIL ${message}`}\n`);
  process.exitCode = 1;
});
