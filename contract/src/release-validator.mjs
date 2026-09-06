#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { validateContract } from '../lib/contract.mjs';

const directory = resolve(process.argv[2] ?? '.');
const candidate = process.argv[3] ? resolve(process.argv[3]) : undefined;
const manifest = JSON.parse(await readFile(resolve(directory, 'manifest.json'), 'utf8'));
if (manifest.schemaVersion !== '1.0.0') throw new Error(`incompatible schema version: ${manifest.schemaVersion}`);
if (manifest.compatibleSchemaVersions !== '>=1.0.0 <2.0.0') throw new Error('unsupported compatibility range');
for (const artifact of manifest.artifacts) {
  const content = await readFile(resolve(directory, artifact.path));
  const digest = createHash('sha256').update(content).digest('hex');
  if (digest !== artifact.sha256) throw new Error(`checksum mismatch: ${artifact.path}`);
  if (content.byteLength !== artifact.bytes) throw new Error(`size mismatch: ${artifact.path}`);
}
for (const fixture of manifest.fixtures) {
  const document = JSON.parse(await readFile(resolve(directory, fixture), 'utf8'));
  validateContract(document);
}
if (candidate) validateContract(JSON.parse(await readFile(candidate, 'utf8')));
console.log(`validated Kolibri neutral contract ${manifest.releaseVersion}: ${manifest.artifacts.length} artifacts, ${manifest.fixtures.length} fixtures${candidate ? ', 1 consumer document' : ''}`);
