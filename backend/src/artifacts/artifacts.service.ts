import { Injectable } from '@nestjs/common';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import type { GeneratedArtifact } from '../figma-importer/figma-importer.types';

@Injectable()
export class ArtifactsService {
  async writeArtifacts(
    baseDir: string,
    artifacts: GeneratedArtifact[],
  ): Promise<void> {
    const root = resolve(baseDir);
    await Promise.all(
      artifacts.map(async (artifact) => {
        const outputPath = resolve(root, artifact.path);
        if (relative(root, outputPath).startsWith('..')) {
          throw new Error(
            `Artifact path escapes output directory: ${artifact.path}`,
          );
        }
        await mkdir(dirname(outputPath), { recursive: true });
        await writeFile(
          outputPath,
          Buffer.from(artifact.content, artifact.encoding ?? 'utf8'),
        );
      }),
    );
  }
}
