import {
  DeleteObjectsCommand,
  GetObjectCommand,
  PutObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { GeneratedArtifact } from '../figma-importer/figma-importer.types';
import {
  GenerationStorage,
  type GenerationArtifactAccess,
  type StoredGenerationPackage,
} from './generation-storage';
import {
  S3_STORAGE_BUCKET,
  S3_STORAGE_CLIENT,
  S3_STORAGE_PREFIX,
  S3_STORAGE_PRESIGNED_TTL,
  S3_STORAGE_PRESIGNER,
} from './storage.constants';
import {
  assertRunId,
  createPackageArchive,
  safeDownloadFilename,
} from './storage.utils';

export type S3Presigner = (
  client: S3Client,
  command: GetObjectCommand,
  options: { expiresIn: number },
) => Promise<string>;

@Injectable()
export class S3GenerationStorage extends GenerationStorage {
  private readonly ttlSeconds: number;

  constructor(
    @Inject(S3_STORAGE_CLIENT) private readonly client: S3Client,
    @Inject(S3_STORAGE_BUCKET) private readonly bucket: string,
    @Inject(S3_STORAGE_PREFIX) private readonly prefix: string,
    @Inject(S3_STORAGE_PRESIGNED_TTL) ttlSeconds: number,
    @Inject(S3_STORAGE_PRESIGNER) private readonly presign: S3Presigner,
  ) {
    super();
    if (!Number.isInteger(ttlSeconds) || ttlSeconds < 60 || ttlSeconds > 900) {
      throw new Error(
        'S3 presigned lifetime must be between 60 and 900 seconds',
      );
    }
    this.ttlSeconds = ttlSeconds;
  }

  async storeRawSnapshot(runId: string, snapshot: unknown): Promise<void> {
    assertRunId(runId);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.requiredBucket(),
        Key: this.rawKey(runId),
        Body: `${JSON.stringify(snapshot, null, 2)}\n`,
        ContentType: 'application/json; charset=utf-8',
        ServerSideEncryption: 'AES256',
      }),
    );
  }

  async storePackageArtifacts(
    runId: string,
    packageArchiveName: string,
    artifacts: GeneratedArtifact[],
  ): Promise<StoredGenerationPackage> {
    assertRunId(runId);
    const filename = safeDownloadFilename(packageArchiveName);
    const key = this.packageKey(runId, filename);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.requiredBucket(),
        Key: key,
        Body: createPackageArchive(artifacts),
        ContentType: 'application/zip',
        ContentDisposition: `attachment; filename="${filename}"`,
        ServerSideEncryption: 'AES256',
      }),
    );
    return { reference: `s3:${key}`, artifactCount: artifacts.length };
  }

  async resolveArtifactAccess(
    reference: string,
  ): Promise<GenerationArtifactAccess> {
    const key = this.parsePackageReference(reference);
    const filename = key.split('/').at(-1)!;
    const command = new GetObjectCommand({
      Bucket: this.requiredBucket(),
      Key: key,
      ResponseContentType: 'application/zip',
      ResponseContentDisposition: `attachment; filename="${filename}"`,
    });
    return {
      kind: 'redirect',
      url: await this.presign(this.client, command, {
        expiresIn: this.ttlSeconds,
      }),
      expiresInSeconds: this.ttlSeconds,
    };
  }

  async removeRun(
    runId: string,
    artifactReference: string | null,
  ): Promise<void> {
    assertRunId(runId);
    const keys = [this.rawKey(runId)];
    if (artifactReference) {
      keys.push(this.parsePackageReference(artifactReference));
    }
    await this.client.send(
      new DeleteObjectsCommand({
        Bucket: this.requiredBucket(),
        Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true },
      }),
    );
  }

  private rawKey(runId: string): string {
    return `${this.prefix}/runs/${runId}/raw/figma-file.json`;
  }

  private packageKey(runId: string, filename: string): string {
    return `${this.prefix}/runs/${runId}/package/${filename}`;
  }

  private parsePackageReference(reference: string): string {
    const expected = `s3:${this.prefix}/runs/`;
    if (!reference.startsWith(expected)) {
      throw new NotFoundException('Generation artifact not found');
    }
    const key = reference.slice('s3:'.length);
    const relative = key.slice(`${this.prefix}/runs/`.length);
    const [storedRunId, directory, filename, extra] = relative.split('/');
    if (
      extra !== undefined ||
      directory !== 'package' ||
      !/^[a-zA-Z0-9._-]+\.zip$/.test(filename || '')
    ) {
      throw new NotFoundException('Generation artifact not found');
    }
    try {
      assertRunId(storedRunId);
    } catch {
      throw new NotFoundException('Generation artifact not found');
    }
    return key;
  }

  private requiredBucket(): string {
    if (!this.bucket) throw new Error('S3 storage bucket is not configured');
    return this.bucket;
  }
}
