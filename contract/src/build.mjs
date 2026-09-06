import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COMPATIBILITY, RELEASE_VERSION, SCHEMA_VERSION, SOURCE_REVISION, serialize, sha256, validateContract } from './contract.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const release = join(root, 'releases', RELEASE_VERSION);
const fixtureSource = join(root, 'fixtures', 'valid');

async function emit(path, content) {
  await mkdir(dirname(join(release, path)), { recursive: true });
  await writeFile(join(release, path), content);
  return { path, bytes: Buffer.byteLength(content), sha256: sha256(content) };
}

await mkdir(release, { recursive: true });
const artifacts = [];
const schema = await readFile(join(root, 'schema', 'kolibri-contract.schema.json'), 'utf8');
artifacts.push(await emit('schema/kolibri-contract.schema.json', schema.endsWith('\n') ? schema : `${schema}\n`));
const contractLibrary = await readFile(join(root, 'src', 'contract.mjs'), 'utf8');
artifacts.push(await emit('lib/contract.mjs', contractLibrary));
const validator = await readFile(join(root, 'src', 'release-validator.mjs'), 'utf8');
artifacts.push(await emit('bin/validate.mjs', validator));

const fixtureNames = (await readdir(fixtureSource)).filter((name) => name.endsWith('.json')).sort();
for (const name of fixtureNames) {
  const input = JSON.parse(await readFile(join(fixtureSource, name), 'utf8'));
  input.metadata = { releaseVersion: RELEASE_VERSION, schemaVersion: SCHEMA_VERSION, compatibleSchemaVersions: COMPATIBILITY, sourceRevision: SOURCE_REVISION };
  validateContract(input);
  artifacts.push(await emit(`fixtures/${name}`, serialize(input)));
}

artifacts.sort((left, right) => left.path.localeCompare(right.path));
const manifest = {
  releaseVersion: RELEASE_VERSION,
  schemaVersion: SCHEMA_VERSION,
  compatibleSchemaVersions: COMPATIBILITY,
  sourceRevision: SOURCE_REVISION,
  artifacts,
  fixtures: fixtureNames.map((name) => `fixtures/${name}`),
};
await emit('manifest.json', serialize(manifest));
console.log(`built Kolibri neutral contract ${RELEASE_VERSION} (${artifacts.length} checksummed artifacts)`);
