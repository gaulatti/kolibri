import {
  GetSecretValueCommand,
  PutSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';
import {
  Inject,
  Injectable,
  BadRequestException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import type { AuthenticatedUser } from '../auth/authenticated-user';
import { SystemConfigurationService } from '../config/system-configuration.service';
import { NpmPublicationService } from '../npm-publication/npm-publication.service';
import { safeErrorMetadata } from '../observability/safe-error';
import { DesignSystem } from '../persistence/entities';
import type { SetDesignSystemRuntimeConfigurationDto } from './dto/set-design-system-runtime-configuration.dto';
import type { SetDesignSystemRuntimeCredentialsDto } from './dto/set-design-system-runtime-credentials.dto';
import {
  DESIGN_SYSTEM_RUNTIME_SECRET_NAME,
  SECRETS_MANAGER_CLIENT,
} from './secrets.constants';

type RuntimeSecret = Record<string, unknown>;

export interface RuntimeConfigurationClient {
  send(
    command: GetSecretValueCommand | PutSecretValueCommand,
  ): Promise<{ SecretString?: string }>;
}

export type DesignSystemRuntimeConfiguration = {
  figma: {
    fileKey: string;
    accessToken: string;
  };
  package: {
    name: string;
  };
  npm?: {
    token: string;
  };
};

export type RuntimeConfiguredView = {
  designSystemId: string;
  configured: true;
};

export type RuntimeConfigurationView = {
  designSystemId: string;
  figmaFileKey: string | null;
  packageName: string | null;
  packageVersion: string | null;
  npmRegistry: string | null;
  figmaAccessTokenConfigured: boolean;
  npmTokenConfigured: boolean;
  generationConfigured: boolean;
};

@Injectable()
export class DesignSystemSecretsService {
  private readonly logger = new Logger(DesignSystemSecretsService.name);
  private mutationTail: Promise<void> = Promise.resolve();

  constructor(
    @InjectRepository(DesignSystem)
    private readonly designSystems: Repository<DesignSystem>,
    @Inject(SECRETS_MANAGER_CLIENT)
    private readonly client: RuntimeConfigurationClient,
    @Inject(DESIGN_SYSTEM_RUNTIME_SECRET_NAME)
    private readonly secretName: string,
    private readonly npmPublication: NpmPublicationService,
    private readonly systemConfiguration: SystemConfigurationService,
  ) {}

  async setRuntimeConfiguration(
    user: AuthenticatedUser,
    designSystemId: string,
    input: SetDesignSystemRuntimeConfigurationDto,
  ): Promise<RuntimeConfigurationView> {
    await this.findOwned(user, designSystemId);
    let view!: RuntimeConfigurationView;
    await this.mutateConfiguration(async (configuration) => {
      const key = designSystemId;
      const current = objectValue(configuration[key]);
      const currentFigma = objectValue(current.figma);
      const currentNpm = objectValue(current.npm);
      const npmToken = requiredString(currentNpm.token) ?? undefined;
      const resolved = await this.npmPublication.resolveNextVersion(
        input.packageName,
        npmToken,
      );

      configuration[key] = {
        ...current,
        figma: {
          ...currentFigma,
          fileKey: input.figmaFileKey,
        },
        package: {
          name: input.packageName,
          version: resolved.version,
        },
      };
      const figmaAccessTokenConfigured = Boolean(
        requiredString(currentFigma.accessToken),
      );
      view = {
        designSystemId,
        figmaFileKey: input.figmaFileKey,
        packageName: input.packageName,
        packageVersion: resolved.version,
        npmRegistry: resolved.registry,
        figmaAccessTokenConfigured,
        npmTokenConfigured: Boolean(npmToken),
        generationConfigured: figmaAccessTokenConfigured,
      };
      return true;
    });
    return view;
  }

  async setRuntimeCredentials(
    user: AuthenticatedUser,
    designSystemId: string,
    input: SetDesignSystemRuntimeCredentialsDto,
  ): Promise<RuntimeConfiguredView> {
    await this.findOwned(user, designSystemId);
    const figmaAccessToken = input.figmaAccessToken?.trim();
    const npmToken = input.npmToken?.trim();
    if (!figmaAccessToken && !npmToken) {
      throw new BadRequestException(
        'At least one runtime credential must be provided',
      );
    }
    await this.mutateConfiguration((configuration) => {
      const key = designSystemId;
      const current = objectValue(configuration[key]);
      const currentFigma = objectValue(current.figma);
      const currentNpm = objectValue(current.npm);

      configuration[key] = {
        ...current,
        figma: {
          ...currentFigma,
          ...(figmaAccessToken ? { accessToken: figmaAccessToken } : {}),
        },
        ...(npmToken || typeof currentNpm.token === 'string'
          ? {
              npm: {
                ...currentNpm,
                ...(npmToken ? { token: npmToken } : {}),
              },
            }
          : {}),
      };
      return true;
    });
    return { designSystemId, configured: true };
  }

  async updatePackageVersion(
    designSystemId: string,
    packageVersion: string,
  ): Promise<void> {
    await this.mutateConfiguration((configuration) => {
      const key = designSystemId;
      const current = objectValue(configuration[key]);
      const packageConfiguration = objectValue(current.package);
      if (!Object.keys(packageConfiguration).length) return false;
      configuration[key] = {
        ...current,
        package: {
          ...packageConfiguration,
          version: packageVersion,
        },
      };
      return true;
    });
  }

  async getRuntimeConfigurationView(
    user: AuthenticatedUser,
    designSystemId: string,
  ): Promise<RuntimeConfigurationView> {
    await this.findOwned(user, designSystemId);
    let configuration: RuntimeSecret;
    try {
      configuration = await this.readConfiguration(true);
    } catch (error) {
      this.logSecretFailure(
        'design_system_runtime_configuration_read_failed',
        error,
        designSystemId,
      );
      throw new ServiceUnavailableException(
        'Runtime configuration is unavailable for this design system',
      );
    }

    const entry = objectValue(configuration[designSystemId]);
    const figma = objectValue(entry.figma);
    const packageConfiguration = objectValue(entry.package);
    const npm = objectValue(entry.npm);
    const figmaFileKey = requiredString(figma.fileKey);
    const packageName = requiredString(packageConfiguration.name);
    const packageVersion = requiredString(packageConfiguration.version);
    const npmRegistry = await this.systemConfiguration.npmRegistry();
    const figmaAccessTokenConfigured = Boolean(
      requiredString(figma.accessToken),
    );
    const npmTokenConfigured = Boolean(requiredString(npm.token));

    return {
      designSystemId,
      figmaFileKey,
      packageName,
      packageVersion,
      npmRegistry,
      figmaAccessTokenConfigured,
      npmTokenConfigured,
      generationConfigured: Boolean(
        figmaFileKey &&
        isValidFigmaFileKey(figmaFileKey) &&
        packageName &&
        figmaAccessTokenConfigured,
      ),
    };
  }

  async getRuntimeConfiguration(
    designSystemId: string,
  ): Promise<DesignSystemRuntimeConfiguration> {
    let configuration: RuntimeSecret;
    try {
      configuration = await this.readConfiguration();
    } catch (error) {
      this.logSecretFailure(
        'design_system_runtime_configuration_read_failed',
        error,
        designSystemId,
      );
      throw new ServiceUnavailableException(
        'Runtime configuration is unavailable for this design system',
      );
    }

    const entry = objectValue(configuration[designSystemId]);
    const figma = objectValue(entry.figma);
    const packageConfiguration = objectValue(entry.package);
    const npm = objectValue(entry.npm);
    const fileKey = requiredString(figma.fileKey);
    const accessToken = requiredString(figma.accessToken);
    const packageName = requiredString(packageConfiguration.name);
    if (
      !fileKey ||
      !isValidFigmaFileKey(fileKey) ||
      !accessToken ||
      !packageName
    ) {
      throw new ServiceUnavailableException(
        'Runtime configuration is not configured for this design system',
      );
    }

    const npmToken = requiredString(npm.token);
    return {
      figma: { fileKey, accessToken },
      package: { name: packageName },
      ...(npmToken ? { npm: { token: npmToken } } : {}),
    };
  }

  async deleteDesignSystemConfiguration(designSystemId: string): Promise<void> {
    await this.mutateConfiguration((configuration) => {
      const key = designSystemId;
      if (!(key in configuration)) return false;
      delete configuration[key];
      return true;
    });
  }

  private async mutateConfiguration(
    mutation: (configuration: RuntimeSecret) => boolean | Promise<boolean>,
  ): Promise<void> {
    const pending = this.mutationTail.then(async () => {
      try {
        const configuration = await this.readConfiguration(true);
        if (!(await mutation(configuration))) return;
        await this.client.send(
          new PutSecretValueCommand({
            SecretId: this.secretName,
            SecretString: JSON.stringify(configuration),
          }),
        );
      } catch (error) {
        this.logSecretFailure(
          'design_system_runtime_configuration_write_failed',
          error,
        );
        throw new ServiceUnavailableException(
          'Design-system runtime configuration could not be updated',
        );
      }
    });
    this.mutationTail = pending.catch(() => undefined);
    return pending;
  }

  private async readConfiguration(
    allowUninitialized = false,
  ): Promise<RuntimeSecret> {
    try {
      const response = await this.client.send(
        new GetSecretValueCommand({ SecretId: this.secretName }),
      );
      if (!response.SecretString?.trim()) return {};
      const value = JSON.parse(response.SecretString) as unknown;
      if (!isObject(value)) throw new Error('Invalid secret shape');
      return value;
    } catch (error) {
      if (allowUninitialized && isMissingSecretVersion(error)) return {};
      throw error;
    }
  }

  private async findOwned(
    user: AuthenticatedUser,
    id: string,
  ): Promise<DesignSystem> {
    const designSystem = await this.designSystems.findOne({
      where: { id, ownerId: user.userReferenceId },
    });
    if (!designSystem) throw new NotFoundException('Design system not found');
    return designSystem;
  }

  private logSecretFailure(
    event: string,
    error: unknown,
    designSystemId?: string,
  ): void {
    this.logger.error({
      event,
      secretName: this.secretName,
      ...(designSystemId ? { designSystemId } : {}),
      ...safeErrorMetadata(error),
    });
  }
}

function isMissingSecretVersion(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    error.name === 'ResourceNotFoundException'
  );
}

function objectValue(value: unknown): Record<string, unknown> {
  return isObject(value) ? value : {};
}

function requiredString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function isValidFigmaFileKey(value: string): boolean {
  return /^(?!figd_)[A-Za-z0-9_-]+$/i.test(value);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
