import type { Readable } from 'node:stream';
import type { GeneratedArtifact } from '../figma-importer/figma-importer.types';

export type StoredGenerationPackage = {
  reference: string;
  artifactCount: number;
};

export type GenerationArtifactAccess =
  | {
      kind: 'stream';
      stream: Readable;
      contentType: 'application/zip';
      filename: string;
    }
  | {
      kind: 'redirect';
      url: string;
      expiresInSeconds: number;
    };

export abstract class GenerationStorage {
  abstract storeRawSnapshot(runId: string, snapshot: unknown): Promise<void>;

  abstract storePackageArtifacts(
    runId: string,
    packageArchiveName: string,
    artifacts: GeneratedArtifact[],
  ): Promise<StoredGenerationPackage>;

  abstract resolveArtifactAccess(
    reference: string,
  ): Promise<GenerationArtifactAccess>;

  abstract removeRun(
    runId: string,
    artifactReference: string | null,
  ): Promise<void>;
}
