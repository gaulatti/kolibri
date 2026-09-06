import type { KolibriSystemSecret } from '../config/kolibri-system-secret';

export type StorageConfiguration =
  | {
      driver: 'local';
      bucket: '';
      presignedUrlTtlSeconds: 300;
    }
  | {
      driver: 's3';
      bucket: string;
      presignedUrlTtlSeconds: number;
    };

export function storageConfiguration(
  systemSecret: KolibriSystemSecret | null,
): StorageConfiguration {
  if (!systemSecret) {
    return {
      driver: 'local',
      bucket: '',
      presignedUrlTtlSeconds: 300,
    };
  }

  const value = systemSecret.storage;
  if (!isObject(value) || value.driver !== 's3') {
    throw new Error(
      'Kolibri system configuration has invalid storage settings',
    );
  }
  if (typeof value.bucket !== 'string' || !value.bucket.trim()) {
    throw new Error(
      'Kolibri system configuration has invalid storage settings',
    );
  }

  const ttl = value.presignedUrlTtlSeconds ?? 300;
  if (!Number.isInteger(ttl) || Number(ttl) < 60 || Number(ttl) > 900) {
    throw new Error(
      'Kolibri system configuration has invalid storage settings',
    );
  }

  return {
    driver: 's3',
    bucket: value.bucket.trim(),
    presignedUrlTtlSeconds: Number(ttl),
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
