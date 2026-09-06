import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { ArtifactsService } from '../artifacts/artifacts.service';
import { GenerationStorage } from './generation-storage';
import { LocalGenerationStorage } from './local-generation.storage';

const runId = 'f515082d-5e8b-4309-a52e-1ec6cc4c4627';
const artifacts = [
  { path: 'kolibri-ui/package.json', content: '{"name":"@kolibri/ui"}' },
  { path: 'kolibri-ui/src/index.ts', content: 'export {};\n' },
];

describe('LocalGenerationStorage contract', () => {
  let outputDirectory: string;
  let storage: LocalGenerationStorage;

  beforeEach(async () => {
    outputDirectory = await mkdtemp(join(tmpdir(), 'kolibri-storage-'));
    storage = new LocalGenerationStorage(
      new ArtifactsService(),
      outputDirectory,
    );
  });

  afterEach(async () => {
    await rm(outputDirectory, { recursive: true, force: true });
  });

  it('stores private raw data and provides only the package archive stream', async () => {
    expect(storage).toBeInstanceOf(GenerationStorage);
    await storage.storeRawSnapshot(runId, { name: 'Fixture' });
    const stored = await storage.storePackageArtifacts(
      runId,
      'kolibri-ui',
      artifacts,
    );

    expect(stored).toEqual({
      reference: `local:runs/${runId}/download/kolibri-ui.zip`,
      artifactCount: 2,
    });
    await expect(
      readFile(
        resolve(outputDirectory, 'runs', runId, 'raw', 'figma-file.json'),
        'utf8',
      ),
    ).resolves.toContain('Fixture');

    const access = await storage.resolveArtifactAccess(stored.reference);
    expect(access).toMatchObject({
      kind: 'stream',
      contentType: 'application/zip',
      filename: 'kolibri-ui.zip',
    });
    expect(access).not.toHaveProperty('path');
    if (access.kind !== 'stream') throw new Error('Expected stream access');
    const chunks: Buffer[] = [];
    for await (const value of access.stream) {
      const chunk: unknown = value;
      if (!(chunk instanceof Uint8Array)) throw new Error('Expected bytes');
      chunks.push(Buffer.from(chunk));
    }
    expect(Buffer.concat(chunks).subarray(0, 2).toString()).toBe('PK');

    await expect(
      storage.resolveArtifactAccess(`local:runs/${runId}/raw/figma-file.json`),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('rejects path traversal and never writes outside the configured root', async () => {
    await expect(
      storage.storePackageArtifacts(runId, 'kolibri-ui', [
        { path: '../outside.txt', content: 'unsafe' },
      ]),
    ).rejects.toThrow();
    await expect(storage.storeRawSnapshot('../escape', {})).rejects.toThrow(
      'Invalid generation run ID',
    );
  });

  it('removes all stored material for a run', async () => {
    await storage.storeRawSnapshot(runId, { name: 'Fixture' });
    await storage.removeRun(runId, null);
    await expect(
      readFile(
        resolve(outputDirectory, 'runs', runId, 'raw', 'figma-file.json'),
      ),
    ).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('maps absent, directory, wrong-driver, and escaping artifact references safely', async () => {
    await expect(
      storage.resolveArtifactAccess(`local:runs/${runId}/download/missing.zip`),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      storage.resolveArtifactAccess('s3:anything'),
    ).rejects.toMatchObject({ status: 404 });
    const internals = storage as unknown as {
      resolveBelowRoot(path: string): string;
    };
    expect(() => internals.resolveBelowRoot('../escape')).toThrow(
      'Unsafe storage path',
    );
    expect(() => internals.resolveBelowRoot('/absolute')).toThrow(
      'Unsafe storage path',
    );
    const directoryArtifact = resolve(
      outputDirectory,
      'runs',
      runId,
      'download',
      'directory.zip',
    );
    await mkdir(directoryArtifact, { recursive: true });
    await expect(
      storage.resolveArtifactAccess(
        `local:runs/${runId}/download/directory.zip`,
      ),
    ).rejects.toMatchObject({ status: 404 });
  });
});
