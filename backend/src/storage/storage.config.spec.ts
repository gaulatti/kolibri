import { storageConfiguration } from './storage.config';

describe('storage configuration', () => {
  it('uses local storage when the system secret is unavailable locally', () => {
    expect(storageConfiguration(null)).toEqual({
      driver: 'local',
      bucket: '',
      presignedUrlTtlSeconds: 300,
    });
  });

  it('loads S3 storage from the Kolibri system secret', () => {
    expect(
      storageConfiguration({
        storage: {
          driver: 's3',
          bucket: 'kolibri-generation-storage',
          presignedUrlTtlSeconds: 600,
        },
      }),
    ).toEqual({
      driver: 's3',
      bucket: 'kolibri-generation-storage',
      presignedUrlTtlSeconds: 600,
    });
  });

  it('defaults the presigned URL lifetime to five minutes when unset', () => {
    expect(
      storageConfiguration({ storage: { driver: 's3', bucket: 'bucket' } }),
    ).toEqual({
      driver: 's3',
      bucket: 'bucket',
      presignedUrlTtlSeconds: 300,
    });
  });

  it('rejects missing or unsafe production storage settings', () => {
    expect(() => storageConfiguration({ postgresql: {} })).toThrow(
      'invalid storage settings',
    );
    expect(() =>
      storageConfiguration({
        storage: { driver: 's3', bucket: '', presignedUrlTtlSeconds: 3600 },
      }),
    ).toThrow('invalid storage settings');
    expect(() =>
      storageConfiguration({
        storage: { driver: 's3', bucket: 'bucket', presignedUrlTtlSeconds: 59 },
      }),
    ).toThrow('invalid storage settings');
    expect(() =>
      storageConfiguration({
        storage: {
          driver: 's3',
          bucket: 'bucket',
          presignedUrlTtlSeconds: 90.5,
        },
      }),
    ).toThrow('invalid storage settings');
  });
});
