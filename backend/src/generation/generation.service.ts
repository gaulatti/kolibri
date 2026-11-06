import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import type { AuthenticatedUser } from '../auth/authenticated-user';
import { FigmaClient } from '../clients/figma/figma.client';
import { CssExporterService } from '../css-exporter/css-exporter.service';
import { ReactExporterService } from '../exporters/react/react-exporter.service';
import { FigmaImporterService } from '../figma-importer/figma-importer.service';
import type { Diagnostic } from '../figma-importer/figma-importer.types';
import { derivePackageDirectoryName } from '../package-assembler/generated-package-config';
import { PackageAssemblerService } from '../package-assembler/package-assembler.service';
import { NpmPublicationService } from '../npm-publication/npm-publication.service';
import {
  safeErrorMetadata,
  sanitizeLogText,
} from '../observability/safe-error';
import {
  DesignSystem,
  GenerationRun,
  GenerationRunStatus,
} from '../persistence/entities';
import {
  DesignSystemSecretsService,
  type DesignSystemRuntimeConfiguration,
} from '../secrets/design-system-secrets.service';
import {
  GenerationStorage,
  type GenerationArtifactAccess,
} from '../storage/generation-storage';
import { GenerationEventsService } from './generation-events.service';
import {
  GENERATION_TASK_SCHEDULER,
  type GenerationTaskScheduler,
} from './generation-task.scheduler';
import {
  GENERATION_PHASES,
  type GenerationQueuedView,
  type GenerationRunView,
} from './generation.types';

const SAFE_FAILURE_SUMMARY =
  'Generation failed. Check the design-system configuration and try again.';
const SAFE_PUBLICATION_FAILURE_SUMMARY =
  'The package was generated, but npm publication failed. Check the npm configuration and try again.';

type GenerationExecutionConfiguration = DesignSystemRuntimeConfiguration & {
  package: DesignSystemRuntimeConfiguration['package'] & {
    version: string;
    registry: string;
  };
};

@Injectable()
export class GenerationService {
  private readonly logger = new Logger(GenerationService.name);
  private versionReservationTail: Promise<void> = Promise.resolve();

  constructor(
    @InjectRepository(DesignSystem)
    private readonly designSystems: Repository<DesignSystem>,
    @InjectRepository(GenerationRun)
    private readonly runs: Repository<GenerationRun>,
    private readonly events: GenerationEventsService,
    private readonly secrets: DesignSystemSecretsService,
    private readonly figmaClient: FigmaClient,
    private readonly importer: FigmaImporterService,
    private readonly cssExporter: CssExporterService,
    private readonly reactExporter: ReactExporterService,
    private readonly packageAssembler: PackageAssemblerService,
    private readonly npmPublication: NpmPublicationService,
    private readonly storage: GenerationStorage,
    @Inject(GENERATION_TASK_SCHEDULER)
    private readonly scheduler: GenerationTaskScheduler,
  ) {}

  async queue(
    user: AuthenticatedUser,
    designSystemId: string,
    publishToNpm = false,
  ): Promise<GenerationQueuedView> {
    const designSystem = await this.designSystems.findOne({
      where: { id: designSystemId, ownerId: user.userReferenceId },
    });
    if (!designSystem) throw new NotFoundException('Design system not found');
    const runtime = await this.secrets.getRuntimeConfiguration(designSystem.id);
    if (publishToNpm && !runtime.npm?.token) {
      throw new BadRequestException(
        'npm publishing is not configured for this design system',
      );
    }
    const reservation = this.versionReservationTail.then(async () => {
      const latestRun = await this.runs.findOne({
        where: { packageName: runtime.package.name },
        order: { createdAt: 'DESC' },
      });
      const resolved = await this.npmPublication.resolveNextVersion(
        runtime.package.name,
        runtime.npm?.token,
        latestRun?.packageVersion,
        latestRun &&
          latestRun.generationContract !== designSystem.generationContract
          ? 'major'
          : 'patch',
      );
      const execution: GenerationExecutionConfiguration = {
        ...runtime,
        package: {
          ...runtime.package,
          version: resolved.version,
          registry: resolved.registry,
        },
      };
      const run = await this.runs.save(
        this.runs.create({
          designSystemId: designSystem.id,
          packageName: runtime.package.name,
          packageVersion: resolved.version,
          generationContract: designSystem.generationContract,
          publishRequested: publishToNpm,
          publishedAt: null,
          publicationFailureSummary: null,
          status: GenerationRunStatus.PENDING,
          startedAt: null,
          completedAt: null,
          artifactCount: 0,
          tokenCount: 0,
          componentCount: 0,
          warningCount: 0,
          errorCount: 0,
          artifactReference: null,
          failureSummary: null,
        }),
      );
      return { execution, resolved, run };
    });
    this.versionReservationTail = reservation.then(
      () => undefined,
      () => undefined,
    );
    let reserved: Awaited<typeof reservation>;
    try {
      reserved = await reservation;
    } catch (error) {
      this.logger.error({
        event: 'generation_version_reservation_failed',
        designSystemId: designSystem.id,
        ...safeErrorMetadata(error, runtimeRedactions(runtime)),
      });
      throw new ServiceUnavailableException(
        'The package version could not be reserved',
      );
    }
    const { execution, resolved, run } = reserved;
    await this.events.record(
      run.id,
      GENERATION_PHASES.QUEUED,
      'Generation queued.',
    );
    try {
      await this.secrets.updatePackageVersion(
        designSystem.id,
        resolved.version,
      );
    } catch (error) {
      this.logger.warn({
        event: 'assigned_version_secret_sync_failed',
        runId: run.id,
        designSystemId: run.designSystemId,
        ...safeErrorMetadata(error, runtimeRedactions(execution)),
      });
    }
    this.scheduler.schedule(() => this.process(run.id, execution));

    return { runId: run.id, status: GenerationRunStatus.PENDING };
  }

  async getOwnedRun(
    user: AuthenticatedUser,
    id: string,
  ): Promise<GenerationRunView> {
    return this.toView(await this.findOwnedRun(user, id));
  }

  async getArtifactAccess(
    user: AuthenticatedUser,
    id: string,
  ): Promise<GenerationArtifactAccess> {
    const run = await this.findOwnedRun(user, id);
    if (
      run.status !== GenerationRunStatus.SUCCEEDED ||
      !run.artifactReference
    ) {
      throw new NotFoundException('Generation artifact not found');
    }
    return this.storage.resolveArtifactAccess(run.artifactReference);
  }

  private async findOwnedRun(
    user: AuthenticatedUser,
    id: string,
  ): Promise<GenerationRun> {
    const run = await this.runs.findOne({
      where: {
        id,
        designSystem: { ownerId: user.userReferenceId },
      },
    });
    if (!run) throw new NotFoundException('Generation run not found');
    return run;
  }

  private async process(
    runId: string,
    runtime: GenerationExecutionConfiguration,
  ): Promise<void> {
    const run = await this.runs.findOne({
      where: { id: runId },
      relations: { designSystem: true },
    });
    if (!run) return;
    let operation = 'starting';

    try {
      run.status = GenerationRunStatus.RUNNING;
      run.startedAt = new Date();
      await this.runs.save(run);
      await this.events.record(
        run.id,
        GENERATION_PHASES.RETRIEVING_SOURCE,
        'Retrieving the configured Figma source.',
      );

      operation = 'loading_figma_file';
      const figmaFile = await this.figmaClient.loadFile(
        runtime.figma.fileKey,
        runtime.figma.accessToken,
      );
      operation = 'storing_raw_snapshot';
      await this.storage.storeRawSnapshot(run.id, figmaFile);

      await this.events.record(
        run.id,
        GENERATION_PHASES.NORMALIZING,
        'Normalizing design tokens and components.',
      );
      operation = 'normalizing';
      const normalized = this.importer.importDesignSystem(
        figmaFile,
        run.generationContract,
      );
      run.tokenCount = normalized.tokens.length;
      run.componentCount = normalized.components.length;
      run.warningCount = normalized.diagnostics.filter(
        (diagnostic) => diagnostic.severity === 'warning',
      ).length;
      run.errorCount = normalized.diagnostics.filter(
        (diagnostic) => diagnostic.severity === 'error',
      ).length;
      operation = 'persisting_diagnostics';
      for (const diagnostic of normalized.diagnostics) {
        await this.events.record(
          run.id,
          diagnostic.severity === 'error'
            ? GENERATION_PHASES.DIAGNOSTIC_ERROR
            : GENERATION_PHASES.DIAGNOSTIC_WARNING,
          safeDiagnosticMessage(diagnostic),
        );
      }
      operation = 'loading_figma_images';
      const imageAssets = await this.figmaClient.loadImageAssets(
        runtime.figma.fileKey,
        runtime.figma.accessToken,
        normalized.imageReferences,
      );
      const imageArtifacts = imageAssets.map((asset) => ({
        path: `assets/figma-${asset.imageRef}.png`,
        content: asset.contentBase64,
        encoding: 'base64' as const,
      }));

      const packageDirectoryName = derivePackageDirectoryName(
        runtime.package.name,
      );
      if (!packageDirectoryName) throw new Error('Invalid package directory');
      const preparePackage = async (packageVersion: string) => {
        await this.events.record(
          run.id,
          GENERATION_PHASES.GENERATING,
          'Generating the design-system package.',
        );
        operation = 'assembling_package';
        const packageArtifacts = this.packageAssembler.assemblePackage({
          packageName: runtime.package.name,
          packageVersion,
          packageRegistry: runtime.package.registry,
          packageDirectoryName,
          packageDescription: run.designSystem.description,
          cssArtifact: {
            path: 'styles/kolibri.css',
            content: this.cssExporter.generateCss(normalized),
          },
          reactArtifacts: this.reactExporter.generateComponents(
            normalized,
            run.generationContract,
          ),
          generationContract: run.generationContract,
          assetArtifacts: imageArtifacts,
        });
        await this.events.record(
          run.id,
          GENERATION_PHASES.STORING,
          'Storing generated artifacts and the source snapshot.',
        );
        operation = 'storing_package';
        const packageArchiveName = `${packageDirectoryName}-${packageVersion}`;
        const storedPackage = await this.storage.storePackageArtifacts(
          run.id,
          packageArchiveName,
          packageArtifacts,
        );
        run.packageVersion = packageVersion;
        run.artifactCount = storedPackage.artifactCount;
        run.artifactReference = storedPackage.reference;
        await this.runs.save(run);
        return { packageDirectoryName, artifacts: packageArtifacts };
      };

      const prepared = await preparePackage(run.packageVersion);
      if (run.publishRequested && runtime.npm?.token) {
        try {
          await this.events.record(
            run.id,
            GENERATION_PHASES.PUBLISHING,
            `Publishing ${run.packageName}@${run.packageVersion} to npm.`,
          );
          operation = 'publishing_npm_package';
          const publishedVersion = await this.npmPublication.publishVersion(
            {
              version: run.packageVersion,
              token: runtime.npm.token,
            },
            prepared,
          );
          run.publishedAt = new Date();
          run.publicationFailureSummary = null;
          run.designSystem.lastPublishedVersion = publishedVersion;
          await this.designSystems.save(run.designSystem);
          try {
            await this.secrets.updatePackageVersion(
              run.designSystemId,
              publishedVersion,
            );
          } catch (error) {
            this.logger.warn({
              event: 'published_version_secret_sync_failed',
              runId: run.id,
              designSystemId: run.designSystemId,
              ...safeErrorMetadata(error, runtimeRedactions(runtime)),
            });
          }
        } catch (error) {
          run.publicationFailureSummary = safePublicationFailureSummary(
            error,
            runtimeRedactions(runtime),
          );
          this.logger.error({
            event: 'npm_publication_failed',
            runId: run.id,
            designSystemId: run.designSystemId,
            packageName: run.packageName,
            packageVersion: run.packageVersion,
            registry: runtime.package.registry,
            ...safeErrorMetadata(error, runtimeRedactions(runtime)),
          });
          await this.events.record(
            run.id,
            GENERATION_PHASES.PUBLICATION_FAILED,
            run.publicationFailureSummary,
          );
        }
      }

      run.status = GenerationRunStatus.SUCCEEDED;
      run.completedAt = new Date();
      run.failureSummary = null;
      operation = 'persisting_success';
      await this.runs.save(run);
      await this.events.record(
        run.id,
        GENERATION_PHASES.COMPLETED,
        run.publishedAt
          ? `Generation completed and ${run.packageName}@${run.packageVersion} was published.`
          : 'Generation completed successfully.',
      );
    } catch (error) {
      this.logger.error({
        event: 'generation_failed',
        runId: run.id,
        designSystemId: run.designSystemId,
        operation,
        ...safeErrorMetadata(error, runtimeRedactions(runtime)),
      });
      run.status = GenerationRunStatus.FAILED;
      run.completedAt = new Date();
      run.failureSummary = SAFE_FAILURE_SUMMARY;
      run.errorCount += 1;
      await this.runs.save(run);
      await this.events.record(
        run.id,
        GENERATION_PHASES.DIAGNOSTIC_ERROR,
        safeOperationalFailure(operation),
      );
      await this.events.record(
        run.id,
        GENERATION_PHASES.FAILED,
        SAFE_FAILURE_SUMMARY,
      );
    }
  }

  private toView(run: GenerationRun): GenerationRunView {
    return {
      id: run.id,
      designSystemId: run.designSystemId,
      status: run.status,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      artifactCount: run.artifactCount,
      tokenCount: run.tokenCount,
      componentCount: run.componentCount,
      warningCount: run.warningCount,
      errorCount: run.errorCount,
      packageName: run.packageName,
      packageVersion: run.packageVersion,
      generationContract: run.generationContract,
      publishRequested: run.publishRequested,
      publishedAt: run.publishedAt,
      publicationFailureSummary: run.publicationFailureSummary,
      artifactReference: run.artifactReference,
      failureSummary: run.failureSummary,
      createdAt: run.createdAt,
      updatedAt: run.updatedAt,
    };
  }
}

function safeOperationalFailure(operation: string): string {
  const failures: Record<string, string> = {
    loading_figma_file:
      'SOURCE_RETRIEVAL_FAILED — The Figma file could not be retrieved.',
    storing_raw_snapshot:
      'STORAGE_FAILED — The source snapshot could not be stored.',
    normalizing:
      'NORMALIZATION_FAILED — The Figma file could not be normalized.',
    persisting_diagnostics:
      'DIAGNOSTIC_STORAGE_FAILED — Generation diagnostics could not be stored.',
    loading_figma_images:
      'FIGMA_IMAGE_RETRIEVAL_FAILED — Figma image assets could not be retrieved.',
    assembling_package:
      'PACKAGE_GENERATION_FAILED — The package could not be assembled.',
    storing_package:
      'STORAGE_FAILED — The generated package could not be stored.',
    persisting_success:
      'GENERATION_STATE_FAILED — The completed generation could not be saved.',
  };
  return (
    failures[operation] ??
    'GENERATION_RUNTIME_FAILED — Generation stopped unexpectedly.'
  );
}

function runtimeRedactions(
  runtime: DesignSystemRuntimeConfiguration,
): Array<string | undefined> {
  return [runtime.figma.accessToken, runtime.npm?.token];
}

function safePublicationFailureSummary(
  error: unknown,
  redactions: Array<string | undefined>,
): string {
  const metadata = safeErrorMetadata(error, redactions);
  const detail = metadata.stderr ?? metadata.stdout ?? metadata.errorMessage;
  if (!detail) return SAFE_PUBLICATION_FAILURE_SUMMARY;
  return sanitizeLogText(
    `The package was generated, but npm publication failed. ${detail}`,
    redactions,
    1_000,
  );
}

function safeDiagnosticMessage(diagnostic: Diagnostic): string {
  const details = [
    cleanDiagnosticText(diagnostic.code) || 'GENERATION_DIAGNOSTIC',
    cleanDiagnosticText(diagnostic.message) || 'Generation diagnostic',
    diagnostic.component
      ? `Component: ${cleanDiagnosticText(diagnostic.component)}`
      : null,
    diagnostic.nodeId
      ? `Node: ${cleanDiagnosticText(diagnostic.nodeId)}`
      : null,
  ].filter((value): value is string => Boolean(value));
  return details.join(' — ').slice(0, 1000);
}

function cleanDiagnosticText(value: string): string {
  return [...value]
    .map((character) => {
      const codePoint = character.codePointAt(0) as number;
      return codePoint <= 31 || codePoint === 127 ? ' ' : character;
    })
    .join('')
    .trim();
}
