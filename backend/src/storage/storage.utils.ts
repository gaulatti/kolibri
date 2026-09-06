import AdmZip from 'adm-zip';
import { isAbsolute, posix } from 'node:path';
import type { GeneratedArtifact } from '../figma-importer/figma-importer.types';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function assertRunId(runId: string): void {
  if (!UUID_PATTERN.test(runId)) throw new Error('Invalid generation run ID');
}

export function assertSafeArtifactPath(path: string): void {
  if (!path || path.includes('\\') || path.includes('\0') || isAbsolute(path)) {
    throw new Error('Unsafe artifact path');
  }
  const normalized = posix.normalize(path);
  if (
    normalized === '..' ||
    normalized.startsWith('../') ||
    normalized.startsWith('/')
  ) {
    throw new Error('Unsafe artifact path');
  }
}

export function createPackageArchive(artifacts: GeneratedArtifact[]): Buffer {
  for (const artifact of artifacts) assertSafeArtifactPath(artifact.path);

  const archive = new AdmZip();
  for (const artifact of artifacts) {
    archive.addFile(
      artifact.path,
      Buffer.from(artifact.content, artifact.encoding ?? 'utf8'),
    );
  }
  return archive.toBuffer();
}

export function safeDownloadFilename(packageDirectoryName: string): string {
  const value = packageDirectoryName.replace(/[^a-zA-Z0-9._-]/g, '-');
  if (!value || value === '.' || value === '..') {
    throw new Error('Invalid package filename');
  }
  return `${value}.zip`;
}
