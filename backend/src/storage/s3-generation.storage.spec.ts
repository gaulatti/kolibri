import {
  DeleteObjectsCommand,
  GetObjectCommand,
  PutObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3';
import { GenerationStorage } from './generation-storage';
import { S3GenerationStorage } from './s3-generation.storage';

const runId = 'f515082d-5e8b-4309-a52e-1ec6cc4c4627';
const artifacts = [
  { path: 'kolibri-ui/package.json', content: '{"name":"@kolibri/ui"}' },
];

describe('S3GenerationStorage contract', () => {
  const send = jest.fn();
  const presign = jest.fn();
  let storage: S3GenerationStorage;

  function commandAt(index: number): unknown {
    return (send.mock.calls as unknown[][])[index]?.[0];
  }

  beforeEach(() => {
    jest.clearAllMocks();
    send.mockResolvedValue({});
    presign.mockResolvedValue('https://private-bucket.example/signed');
    storage = new S3GenerationStorage(
      { send } as unknown as S3Client,
      'private-generation-bucket',
      'kolibri',
      300,
      presign,
    );
  });

  it('stores raw and package objects privately under predictable prefixes', async () => {
    expect(storage).toBeInstanceOf(GenerationStorage);
    await storage.storeRawSnapshot(runId, { name: 'Fixture' });
    const stored = await storage.storePackageArtifacts(
      runId,
      'kolibri-ui',
      artifacts,
    );

    expect(stored).toEqual({
      reference: `s3:kolibri/runs/${runId}/package/kolibri-ui.zip`,
      artifactCount: 1,
    });
    const rawCommand = commandAt(0);
    const packageCommand = commandAt(1);
    if (!(rawCommand instanceof PutObjectCommand)) {
      throw new Error('Expected raw PutObjectCommand');
    }
    if (!(packageCommand instanceof PutObjectCommand)) {
      throw new Error('Expected package PutObjectCommand');
    }
    expect(rawCommand.input).toMatchObject({
      Bucket: 'private-generation-bucket',
      Key: `kolibri/runs/${runId}/raw/figma-file.json`,
      ContentType: 'application/json; charset=utf-8',
      ServerSideEncryption: 'AES256',
    });
    expect(packageCommand.input).toMatchObject({
      Key: `kolibri/runs/${runId}/package/kolibri-ui.zip`,
      ContentType: 'application/zip',
      ContentDisposition: 'attachment; filename="kolibri-ui.zip"',
      ServerSideEncryption: 'AES256',
    });
    expect(JSON.stringify(rawCommand)).not.toContain('ACL');
    expect(JSON.stringify(packageCommand)).not.toContain('Metadata');
  });

  it('uses private, bounded presigned download access and rejects raw access', async () => {
    const reference = `s3:kolibri/runs/${runId}/package/kolibri-ui.zip`;
    await expect(storage.resolveArtifactAccess(reference)).resolves.toEqual({
      kind: 'redirect',
      url: 'https://private-bucket.example/signed',
      expiresInSeconds: 300,
    });
    expect(presign).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(GetObjectCommand),
      { expiresIn: 300 },
    );
    const signedCommand = (presign.mock.calls as unknown[][])[0]?.[1];
    if (!(signedCommand instanceof GetObjectCommand)) {
      throw new Error('Expected GetObjectCommand');
    }
    expect(signedCommand.input).toMatchObject({
      Bucket: 'private-generation-bucket',
      Key: `kolibri/runs/${runId}/package/kolibri-ui.zip`,
      ResponseContentType: 'application/zip',
      ResponseContentDisposition: 'attachment; filename="kolibri-ui.zip"',
    });
    expect(300).toBeLessThanOrEqual(900);
    await expect(
      storage.resolveArtifactAccess(
        `s3:kolibri/runs/${runId}/raw/figma-file.json`,
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('rejects an unbounded presigned lifetime', () => {
    expect(
      () =>
        new S3GenerationStorage(
          { send } as unknown as S3Client,
          'private-generation-bucket',
          'kolibri',
          3600,
          presign,
        ),
    ).toThrow('S3 presigned lifetime must be between 60 and 900 seconds');
  });

  it('removes the private raw object and downloadable package object', async () => {
    const reference = `s3:kolibri/runs/${runId}/package/kolibri-ui.zip`;
    await storage.removeRun(runId, reference);
    const command = commandAt(0);
    if (!(command instanceof DeleteObjectsCommand)) {
      throw new Error('Expected DeleteObjectsCommand');
    }
    expect(command.input.Delete).toEqual({
      Objects: [
        { Key: `kolibri/runs/${runId}/raw/figma-file.json` },
        { Key: `kolibri/runs/${runId}/package/kolibri-ui.zip` },
      ],
      Quiet: true,
    });
  });

  it('rejects references for another prefix and malformed run identifiers', async () => {
    await expect(
      storage.resolveArtifactAccess(`s3:other/runs/${runId}/package/file.zip`),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      storage.resolveArtifactAccess(
        's3:kolibri/runs/not-a-uuid/package/file.zip',
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('requires a configured bucket before storage operations', async () => {
    const missingBucket = new S3GenerationStorage(
      { send } as unknown as S3Client,
      '',
      'kolibri',
      300,
      presign,
    );
    await expect(missingBucket.storeRawSnapshot(runId, {})).rejects.toThrow(
      'bucket is not configured',
    );
  });
});
