import { Inject, Injectable } from '@nestjs/common';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import semver from 'semver';
import { SystemConfigurationService } from '../config/system-configuration.service';
import type { GeneratedArtifact } from '../figma-importer/figma-importer.types';
import { sanitizeLogText } from '../observability/safe-error';
import { assertSafeArtifactPath } from '../storage/storage.utils';
import {
  NPM_PROCESS_RUNNER,
  NPM_REGISTRY_FETCH,
  type RegistryFetch,
} from './npm-publication.constants';
import type { NpmProcessRunner } from './npm-process.runner';

export type NpmPublicationConfiguration = {
  version: string;
  token: string;
};

export type ResolvedNpmPackageVersion = {
  registry: string;
  version: string;
};

export type PreparedNpmPackage = {
  packageDirectoryName: string;
  artifacts: GeneratedArtifact[];
};

class NpmRegistryRequestError extends Error {
  override readonly name = 'NpmRegistryRequestError';

  constructor(
    readonly statusCode: number,
    readonly command: string,
    readonly stderr: string | undefined,
  ) {
    super(`npm registry request failed with HTTP ${statusCode}`);
  }
}

@Injectable()
export class NpmPublicationService {
  private publicationTail: Promise<void> = Promise.resolve();

  constructor(
    @Inject(NPM_PROCESS_RUNNER)
    private readonly runner: NpmProcessRunner,
    @Inject(NPM_REGISTRY_FETCH)
    private readonly registryFetch: RegistryFetch,
    private readonly systemConfiguration: SystemConfigurationService,
  ) {}

  async resolveNextVersion(
    packageName: string,
    token?: string,
    latestAssignedVersion?: string | null,
    releaseType: 'patch' | 'minor' | 'major' = 'patch',
  ): Promise<ResolvedNpmPackageVersion> {
    const registry = new URL(await this.systemConfiguration.npmRegistry());
    const publishedVersion = await this.latestVersion(
      registry,
      packageName,
      token,
    );
    const latestVersion = [publishedVersion, latestAssignedVersion]
      .filter((value): value is string => Boolean(value && semver.valid(value)))
      .sort(semver.rcompare)[0];
    return {
      registry: registry.href,
      version: latestVersion
        ? semver.inc(latestVersion, releaseType)!
        : '1.0.0',
    };
  }

  publishVersion(
    configuration: NpmPublicationConfiguration,
    prepared: PreparedNpmPackage,
  ): Promise<string> {
    const publication = this.publicationTail.then(() =>
      this.publish(configuration, prepared),
    );
    this.publicationTail = publication.then(
      () => undefined,
      () => undefined,
    );
    return publication;
  }

  private async publish(
    configuration: NpmPublicationConfiguration,
    prepared: PreparedNpmPackage,
  ): Promise<string> {
    const registry = new URL(await this.systemConfiguration.npmRegistry());
    const version = semver.valid(configuration.version);
    if (!version) throw new Error('npm package version is invalid');
    await this.publishPreparedPackage(registry, configuration.token, prepared);
    return version;
  }

  private async latestVersion(
    registry: URL,
    packageName: string,
    token?: string,
  ): Promise<string | null> {
    const encodedName = encodeURIComponent(packageName).replace(/^%40/, '@');
    const endpoint = new URL(`${encodedName}/latest`, registry);
    const headers = new Headers({
      Accept: 'application/vnd.npm.install-v1+json, application/json',
    });
    if (token) headers.set('Authorization', `Bearer ${token}`);
    const response = await this.registryFetch(endpoint, { headers });
    if (response.status === 404) return null;
    if (!response.ok) {
      const responseBody = sanitizeLogText(await response.text(), [token]);
      throw new NpmRegistryRequestError(
        response.status,
        `GET ${endpoint.origin}${endpoint.pathname}`,
        responseBody || undefined,
      );
    }
    const body = (await response.json()) as unknown;
    const version = objectString(body, 'version');
    if (!version || !semver.valid(version)) {
      throw new Error('npm registry returned an invalid version');
    }
    return version;
  }

  private async publishPreparedPackage(
    registry: URL,
    token: string,
    prepared: PreparedNpmPackage,
  ): Promise<void> {
    const temporaryRoot = await mkdtemp(join(tmpdir(), 'kolibri-npm-'));
    try {
      const packageRoot = resolve(temporaryRoot, prepared.packageDirectoryName);
      await mkdir(packageRoot, { recursive: true });
      for (const artifact of prepared.artifacts) {
        assertSafeArtifactPath(artifact.path);
        const target = resolve(temporaryRoot, artifact.path);
        const pathFromPackage = relative(packageRoot, target);
        if (
          pathFromPackage === '..' ||
          pathFromPackage.startsWith(`..${sep}`) ||
          pathFromPackage.startsWith('/')
        ) {
          throw new Error('Package artifact is outside its package root');
        }
        await mkdir(dirname(target), { recursive: true });
        await writeFile(
          target,
          Buffer.from(artifact.content, artifact.encoding ?? 'utf8'),
        );
      }

      const npmrc = join(temporaryRoot, '.npmrc');
      await writeFile(
        npmrc,
        `registry=${registry.href}\n${registryCredentialKey(registry)}=${token}\n`,
        { encoding: 'utf8', mode: 0o600 },
      );
      const userConfig = ['--userconfig', npmrc];
      await this.runner.run(packageRoot, [
        'install',
        '--include=dev',
        '--ignore-scripts',
        '--no-audit',
        '--no-fund',
        '--registry',
        registry.href,
        ...userConfig,
      ]);
      await this.runner.run(packageRoot, [
        'run',
        'build',
        '--ignore-scripts',
        ...userConfig,
      ]);
      await this.runner.run(packageRoot, [
        'publish',
        '--ignore-scripts',
        '--access',
        'public',
        '--registry',
        registry.href,
        ...userConfig,
      ]);
    } finally {
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  }
}

function registryCredentialKey(registry: URL): string {
  return `//${registry.host}${registry.pathname}:_authToken`;
}

function objectString(value: unknown, key: string): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const field = (value as Record<string, unknown>)[key];
  return typeof field === 'string' ? field : null;
}
