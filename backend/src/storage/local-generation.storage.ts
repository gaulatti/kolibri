import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { createReadStream } from 'node:fs';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { ArtifactsService } from '../artifacts/artifacts.service';
import type { GeneratedArtifact } from '../figma-importer/figma-importer.types';
import {
  GenerationStorage,
  type GenerationArtifactAccess,
  type StoredGenerationPackage,
} from './generation-storage';
import { LOCAL_STORAGE_OUTPUT_DIRECTORY } from './storage.constants';
import {
  assertRunId,
  createPackageArchive,
  safeDownloadFilename,
} from './storage.utils';

@Injectable()
export class LocalGenerationStorage extends GenerationStorage {
  private readonly root: string;

  constructor(
    private readonly artifacts: ArtifactsService,
    @Inject(LOCAL_STORAGE_OUTPUT_DIRECTORY) outputDirectory: string,
  ) {
    super();
    this.root = resolve(outputDirectory);
  }

  async storeRawSnapshot(runId: string, snapshot: unknown): Promise<void> {
    assertRunId(runId);
    await this.artifacts.writeArtifacts(this.runRoot(runId), [
      {
        path: 'raw/figma-file.json',
        content: `${JSON.stringify(snapshot, null, 2)}\n`,
      },
    ]);
  }

  async storePackageArtifacts(
    runId: string,
    packageArchiveName: string,
    artifacts: GeneratedArtifact[],
  ): Promise<StoredGenerationPackage> {
    assertRunId(runId);
    const filename = safeDownloadFilename(packageArchiveName);
    await this.artifacts.writeArtifacts(
      resolve(this.runRoot(runId), 'package'),
      artifacts,
    );
    const archive = createPackageArchive(artifacts);
    const relativeArchivePath = `runs/${runId}/download/${filename}`;
    const archivePath = this.resolveBelowRoot(relativeArchivePath);
    await mkdir(dirname(archivePath), { recursive: true });
    await writeFile(archivePath, archive);
    return {
      reference: `local:${relativeArchivePath}`,
      artifactCount: artifacts.length,
    };
  }

  async resolveArtifactAccess(
    reference: string,
  ): Promise<GenerationArtifactAccess> {
    const relativePath = this.parsePackageReference(reference);
    const absolutePath = this.resolveBelowRoot(relativePath);
    try {
      const details = await stat(absolutePath);
      if (!details.isFile()) throw new Error('Not a file');
    } catch {
      throw new NotFoundException('Generation artifact not found');
    }
    return {
      kind: 'stream',
      stream: createReadStream(absolutePath),
      contentType: 'application/zip',
      filename: relativePath.split('/').at(-1)!,
    };
  }

  async removeRun(runId: string): Promise<void> {
    assertRunId(runId);
    await rm(this.runRoot(runId), { recursive: true, force: true });
  }

  private runRoot(runId: string): string {
    return this.resolveBelowRoot(`runs/${runId}`);
  }

  private parsePackageReference(reference: string): string {
    if (!reference.startsWith('local:')) {
      throw new NotFoundException('Generation artifact not found');
    }
    const relativePath = reference.slice('local:'.length);
    if (
      !/^runs\/[0-9a-f-]+\/download\/[a-zA-Z0-9._-]+\.zip$/.test(relativePath)
    ) {
      throw new NotFoundException('Generation artifact not found');
    }
    return relativePath;
  }

  private resolveBelowRoot(relativePath: string): string {
    if (isAbsolute(relativePath)) throw new Error('Unsafe storage path');
    const result = resolve(this.root, relativePath);
    const pathFromRoot = relative(this.root, result);
    if (
      pathFromRoot === '..' ||
      pathFromRoot.startsWith(`..${sep}`) ||
      isAbsolute(pathFromRoot)
    ) {
      throw new Error('Unsafe storage path');
    }
    return result;
  }
}
