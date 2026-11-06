import { BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import type { AuthenticatedUser } from '../auth/authenticated-user';
import type { FigmaClient } from '../clients/figma/figma.client';
import type { ReactExporterService } from '../exporters/react/react-exporter.service';
import type { PackageAssemblerService } from '../package-assembler/package-assembler.service';
import type { NpmPublicationService } from '../npm-publication/npm-publication.service';
import {
  DesignSystem,
  GenerationRun,
  GenerationRunStatus,
} from '../persistence/entities';
import type { DesignSystemSecretsService } from '../secrets/design-system-secrets.service';
import type { GenerationStorage } from '../storage/generation-storage';
import type { GenerationEventsService } from './generation-events.service';
import { GenerationService } from './generation.service';
import { GENERATION_PHASES } from './generation.types';

const owner: AuthenticatedUser = {
  userReferenceId: 'fd803cd2-fb10-4d16-85ed-d93eb25a8e4f',
  cognitoSub: 'owner-cognito-sub',
};
const designSystemId = 'c1994330-51c5-4104-a54a-c90d940e03b3';
const runId = 'f515082d-5e8b-4309-a52e-1ec6cc4c4627';

function designSystem(): DesignSystem {
  return {
    id: designSystemId,
    ownerId: owner.userReferenceId,
    name: 'Kolibri UI',
    description: 'Shared application components',
    generationContract: 'composable-v1',
    lastPublishedVersion: null,
    createdAt: new Date('2026-08-01T12:00:00.000Z'),
    updatedAt: new Date('2026-08-01T12:00:00.000Z'),
    owner: undefined as never,
    generationRuns: [],
  };
}

function generationRun(system = designSystem()): GenerationRun {
  return {
    id: runId,
    designSystemId,
    designSystem: system,
    status: GenerationRunStatus.PENDING,
    startedAt: null,
    completedAt: null,
    packageName: '@kolibri/ui',
    packageVersion: '1.0.0',
    generationContract: 'composable-v1',
    publishRequested: false,
    publishedAt: null,
    publicationFailureSummary: null,
    artifactCount: 0,
    tokenCount: 0,
    componentCount: 0,
    warningCount: 0,
    errorCount: 0,
    artifactReference: null,
    failureSummary: null,
    createdAt: new Date('2026-08-01T12:00:00.000Z'),
    updatedAt: new Date('2026-08-01T12:00:00.000Z'),
    events: [],
  };
}

describe('GenerationService', () => {
  const loggerError = jest
    .spyOn(Logger.prototype, 'error')
    .mockImplementation(() => undefined);
  const loggerWarn = jest
    .spyOn(Logger.prototype, 'warn')
    .mockImplementation(() => undefined);
  const designFindOne = jest.fn();
  const designSave = jest.fn();
  const runCreate = jest.fn();
  const runSave = jest.fn();
  const runFindOne = jest.fn();
  const recordEvent = jest.fn();
  const getRuntimeConfiguration = jest.fn();
  const loadFile = jest.fn();
  const loadImageAssets = jest.fn();
  const importDesignSystem = jest.fn();
  const generateCss = jest.fn();
  const generateComponents = jest.fn();
  const assemblePackage = jest.fn();
  const resolveNextVersion = jest.fn();
  const publishVersion = jest.fn();
  const updatePackageVersion = jest.fn();
  const storeRawSnapshot = jest.fn();
  const storePackageArtifacts = jest.fn();
  const resolveArtifactAccess = jest.fn();
  let scheduledTask: (() => Promise<void>) | undefined;
  let run: GenerationRun;
  let service: GenerationService;

  beforeEach(() => {
    jest.clearAllMocks();
    scheduledTask = undefined;
    run = generationRun();
    designFindOne.mockResolvedValue(run.designSystem);
    designSave.mockImplementation((value: DesignSystem) =>
      Promise.resolve(value),
    );
    runCreate.mockImplementation((input: Partial<GenerationRun>) =>
      Object.assign(run, input),
    );
    runSave.mockImplementation((value: GenerationRun) =>
      Promise.resolve(value),
    );
    runFindOne.mockResolvedValue(run);
    recordEvent.mockImplementation(
      (_id: string, eventType: string, message: string) =>
        Promise.resolve({ eventType, message }),
    );
    getRuntimeConfiguration.mockResolvedValue({
      figma: {
        fileKey: 'AbCdEf_123-xyz',
        accessToken: 'super-secret-figma-token',
      },
      package: {
        name: '@kolibri/ui',
      },
      npm: { token: 'super-secret-npm-token' },
    });
    loadFile.mockResolvedValue({
      name: 'Fixture',
      document: { id: '0:0', name: 'Document', type: 'DOCUMENT', children: [] },
    });
    loadImageAssets.mockResolvedValue([]);
    importDesignSystem.mockReturnValue({
      tokens: [{ name: 'color' }, { name: 'space' }],
      fontSources: [],
      imageReferences: [],
      components: [{ name: 'Button' }],
      diagnostics: [
        {
          severity: 'warning',
          code: 'MISSING_SIZING_INTENT',
          message: 'Component requires sizing intent',
          component: 'Button',
          nodeId: '1:2',
        },
        {
          severity: 'error',
          code: 'IMAGE_ALT_REQUIRED',
          message: 'Non-decorative image requires prop.alt',
          component: 'Hero',
          nodeId: '1:3',
        },
      ],
    });
    generateCss.mockReturnValue(':root {}\n');
    generateComponents.mockReturnValue([]);
    assemblePackage.mockReturnValue([
      { path: 'kolibri-ui/package.json', content: '{}' },
    ]);
    storeRawSnapshot.mockResolvedValue(undefined);
    storePackageArtifacts.mockResolvedValue({
      reference: `local:runs/${runId}/download/kolibri-ui-1.0.0.zip`,
      artifactCount: 1,
    });
    resolveArtifactAccess.mockResolvedValue({
      kind: 'redirect',
      url: 'https://download.example/artifact',
      expiresInSeconds: 300,
    });
    updatePackageVersion.mockResolvedValue(undefined);
    resolveNextVersion.mockResolvedValue({
      version: '1.0.0',
      registry: 'https://registry.npmjs.org/',
    });
    publishVersion.mockResolvedValue('1.0.0');

    service = new GenerationService(
      {
        findOne: designFindOne,
        save: designSave,
      } as unknown as Repository<DesignSystem>,
      {
        create: runCreate,
        save: runSave,
        findOne: runFindOne,
      } as unknown as Repository<GenerationRun>,
      { record: recordEvent } as unknown as GenerationEventsService,
      {
        getRuntimeConfiguration,
        updatePackageVersion,
      } as unknown as DesignSystemSecretsService,
      { loadFile, loadImageAssets } as unknown as FigmaClient,
      { importDesignSystem },
      { generateCss },
      { generateComponents } as unknown as ReactExporterService,
      { assemblePackage } as unknown as PackageAssemblerService,
      {
        resolveNextVersion,
        publishVersion,
      } as unknown as NpmPublicationService,
      {
        storeRawSnapshot,
        storePackageArtifacts,
        resolveArtifactAccess,
      } as unknown as GenerationStorage,
      {
        schedule: (task) => {
          scheduledTask = task;
        },
      },
    );
  });

  it('queues generation only for an owned persisted design system', async () => {
    await expect(service.queue(owner, designSystemId)).resolves.toEqual({
      runId,
      status: GenerationRunStatus.PENDING,
    });
    expect(designFindOne).toHaveBeenCalledWith({
      where: { id: designSystemId, ownerId: owner.userReferenceId },
    });
    expect(runCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        designSystemId,
        packageName: '@kolibri/ui',
        packageVersion: '1.0.0',
        status: GenerationRunStatus.PENDING,
      }),
    );
    expect(recordEvent).toHaveBeenCalledWith(
      runId,
      GENERATION_PHASES.QUEUED,
      'Generation queued.',
    );
    expect(scheduledTask).toBeDefined();
  });

  it('returns the same 404 when the design system belongs to another user', async () => {
    designFindOne.mockResolvedValue(null);
    await expect(service.queue(owner, designSystemId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(runSave).not.toHaveBeenCalled();
    expect(scheduledTask).toBeUndefined();
  });

  it('rejects publication before creating a run when npm is not configured', async () => {
    getRuntimeConfiguration.mockResolvedValueOnce({
      figma: { fileKey: 'AbCdEf_123-xyz', accessToken: 'figma-token' },
      package: {
        name: '@kolibri/ui',
      },
    });

    await expect(
      service.queue(owner, designSystemId, true),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(runSave).not.toHaveBeenCalled();
    expect(scheduledTask).toBeUndefined();
  });

  it('retrieves the secret internally and persists successful transitions', async () => {
    const queued = await service.queue(owner, designSystemId);
    await scheduledTask?.();

    expect(queued).not.toHaveProperty('figmaToken');
    expect(getRuntimeConfiguration).toHaveBeenCalledWith(run.designSystem.id);
    expect(loadFile).toHaveBeenCalledWith(
      'AbCdEf_123-xyz',
      'super-secret-figma-token',
    );
    expect(loadImageAssets).toHaveBeenCalledWith(
      'AbCdEf_123-xyz',
      'super-secret-figma-token',
      [],
    );
    expect(importDesignSystem).toHaveBeenCalledWith(
      expect.any(Object),
      'composable-v1',
    );
    expect(generateComponents).toHaveBeenCalledWith(
      expect.any(Object),
      'composable-v1',
    );
    expect(assemblePackage).toHaveBeenCalledWith(
      expect.objectContaining({
        packageName: '@kolibri/ui',
        packageVersion: '1.0.0',
        packageRegistry: 'https://registry.npmjs.org/',
        packageDescription: 'Shared application components',
        generationContract: 'composable-v1',
      }),
    );
    expect(run.status).toBe(GenerationRunStatus.SUCCEEDED);
    expect(run).toMatchObject({
      artifactCount: 1,
      tokenCount: 2,
      componentCount: 1,
      warningCount: 1,
      errorCount: 1,
      artifactReference: `local:runs/${runId}/download/kolibri-ui-1.0.0.zip`,
      failureSummary: null,
    });
    expect(storeRawSnapshot).toHaveBeenCalledWith(
      runId,
      expect.objectContaining({ name: 'Fixture' }),
    );
    expect(storePackageArtifacts).toHaveBeenCalledWith(
      runId,
      'kolibri-ui-1.0.0',
      [{ path: 'kolibri-ui/package.json', content: '{}' }],
    );
    const recordedCalls = recordEvent.mock.calls as unknown[][];
    expect(recordedCalls.map((call) => call[1])).toEqual([
      GENERATION_PHASES.QUEUED,
      GENERATION_PHASES.RETRIEVING_SOURCE,
      GENERATION_PHASES.NORMALIZING,
      GENERATION_PHASES.DIAGNOSTIC_WARNING,
      GENERATION_PHASES.DIAGNOSTIC_ERROR,
      GENERATION_PHASES.GENERATING,
      GENERATION_PHASES.STORING,
      GENERATION_PHASES.COMPLETED,
    ]);
    expect(JSON.stringify(queued)).not.toContain('super-secret-figma-token');
    expect(recordEvent).toHaveBeenCalledWith(
      runId,
      GENERATION_PHASES.DIAGNOSTIC_ERROR,
      'IMAGE_ALT_REQUIRED — Non-decorative image requires prop.alt — Component: Hero — Node: 1:3',
    );
  });

  it('persists a safe failure and logs detailed sanitized diagnostics', async () => {
    loadFile.mockRejectedValue(
      Object.assign(
        new Error('upstream stack mentioning super-secret-figma-token'),
        { name: 'FigmaRequestError', statusCode: 403 },
      ),
    );
    await service.queue(owner, designSystemId);
    await scheduledTask?.();

    expect(run.status).toBe(GenerationRunStatus.FAILED);
    expect(run.completedAt).toBeInstanceOf(Date);
    expect(run.failureSummary).toBe(
      'Generation failed. Check the design-system configuration and try again.',
    );
    expect(run.failureSummary).not.toContain('super-secret-figma-token');
    expect(run.errorCount).toBe(1);
    expect(recordEvent).toHaveBeenCalledWith(
      runId,
      GENERATION_PHASES.DIAGNOSTIC_ERROR,
      'SOURCE_RETRIEVAL_FAILED — The Figma file could not be retrieved.',
    );
    expect(recordEvent).toHaveBeenLastCalledWith(
      runId,
      GENERATION_PHASES.FAILED,
      run.failureSummary,
    );
    expect(loggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'generation_failed',
        runId,
        designSystemId,
        operation: 'loading_figma_file',
        errorName: 'FigmaRequestError',
        errorMessage: 'upstream stack mentioning [REDACTED]',
        // Jest asymmetric matchers are intentionally dynamic.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        errorStack: expect.stringContaining('[REDACTED]'),
        httpStatusCode: 403,
      }),
    );
    expect(JSON.stringify(loggerError.mock.calls)).not.toContain(
      'super-secret-figma-token',
    );
  });

  it('publishes the generated artifact with its backend-assigned version', async () => {
    await service.queue(owner, designSystemId, true);
    await scheduledTask?.();

    expect(resolveNextVersion).toHaveBeenCalledWith(
      '@kolibri/ui',
      'super-secret-npm-token',
      '1.0.0',
      'patch',
    );
    expect(publishVersion).toHaveBeenCalledWith(
      {
        version: '1.0.0',
        token: 'super-secret-npm-token',
      },
      expect.objectContaining({ packageDirectoryName: 'kolibri-ui' }),
    );
    expect(assemblePackage).toHaveBeenCalledWith(
      expect.objectContaining({ packageVersion: '1.0.0' }),
    );
    expect(run).toMatchObject({
      status: GenerationRunStatus.SUCCEEDED,
      packageVersion: '1.0.0',
      publishRequested: true,
      publicationFailureSummary: null,
    });
    expect(run.publishedAt).toBeInstanceOf(Date);
    expect(run.designSystem.lastPublishedVersion).toBe('1.0.0');
    expect(designSave).toHaveBeenCalledWith(run.designSystem);
    expect(updatePackageVersion).toHaveBeenCalledWith(designSystemId, '1.0.0');
  });

  it('reserves a major version when switching generation contracts', async () => {
    runFindOne.mockResolvedValueOnce({
      ...generationRun(),
      packageVersion: '2.4.9',
      generationContract: 'legacy',
    });

    await service.queue(owner, designSystemId, false);

    expect(resolveNextVersion).toHaveBeenCalledWith(
      '@kolibri/ui',
      'super-secret-npm-token',
      '2.4.9',
      'major',
    );
    expect(run.generationContract).toBe('composable-v1');
  });

  it('maps version reservation failures and permits the next reservation', async () => {
    resolveNextVersion.mockRejectedValueOnce(new Error('registry unavailable'));
    await expect(service.queue(owner, designSystemId)).rejects.toMatchObject({
      status: 503,
    });
    expect(loggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'generation_version_reservation_failed',
        designSystemId,
      }),
    );

    resolveNextVersion.mockResolvedValueOnce({
      version: '1.0.0',
      registry: 'https://registry.npmjs.org/',
    });
    await expect(service.queue(owner, designSystemId)).resolves.toMatchObject({
      runId,
    });
  });

  it('keeps the reserved run when secret version synchronization fails', async () => {
    updatePackageVersion.mockRejectedValueOnce(new Error('secret unavailable'));
    await expect(service.queue(owner, designSystemId)).resolves.toMatchObject({
      runId,
    });
    expect(loggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'assigned_version_secret_sync_failed',
        runId,
      }),
    );
  });

  it('stops quietly if a queued run was removed before processing', async () => {
    await service.queue(owner, designSystemId);
    runFindOne.mockResolvedValueOnce(null);
    await scheduledTask?.();
    expect(loadFile).not.toHaveBeenCalled();
  });

  it('includes downloaded image assets in package assembly', async () => {
    importDesignSystem.mockReturnValueOnce({
      tokens: [],
      fontSources: [],
      imageReferences: ['image-ref'],
      components: [],
      diagnostics: [],
    });
    loadImageAssets.mockResolvedValueOnce([
      { imageRef: 'image-ref', contentBase64: 'AQID' },
    ]);
    await service.queue(owner, designSystemId);
    await scheduledTask?.();
    expect(assemblePackage).toHaveBeenCalledWith(
      expect.objectContaining({
        assetArtifacts: [
          {
            path: 'assets/figma-image-ref.png',
            content: 'AQID',
            encoding: 'base64',
          },
        ],
      }),
    );
  });

  it('fails safely when the package name cannot form a directory', async () => {
    getRuntimeConfiguration.mockResolvedValueOnce({
      figma: { fileKey: 'file', accessToken: 'token' },
      package: { name: '@' },
    });
    await service.queue(owner, designSystemId);
    await scheduledTask?.();
    expect(run.status).toBe(GenerationRunStatus.FAILED);
  });

  it('logs but does not fail generation when published-version secret synchronization fails', async () => {
    updatePackageVersion
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('secret unavailable'));
    await service.queue(owner, designSystemId, true);
    await scheduledTask?.();
    expect(run.status).toBe(GenerationRunStatus.SUCCEEDED);
    expect(loggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'published_version_secret_sync_failed',
        runId,
      }),
    );
  });

  it('keeps a generated artifact downloadable when npm publication fails', async () => {
    publishVersion.mockRejectedValueOnce(
      Object.assign(new Error('npm publish failed with exit code 1'), {
        name: 'NpmProcessError',
        command: 'npm publish --ignore-scripts',
        exitCode: 1,
        stderr: 'npm ERR! code E403\n_authToken=super-secret-npm-token',
      }),
    );

    await service.queue(owner, designSystemId, true);
    await scheduledTask?.();

    expect(run.status).toBe(GenerationRunStatus.SUCCEEDED);
    expect(run.artifactReference).toBeTruthy();
    expect(run.publishedAt).toBeNull();
    expect(run.publicationFailureSummary).toBe(
      'The package was generated, but npm publication failed. npm ERR! code E403\n_authToken=[REDACTED]',
    );
    expect(JSON.stringify(run)).not.toContain('super-secret-npm-token');
    expect(recordEvent).toHaveBeenCalledWith(
      runId,
      GENERATION_PHASES.PUBLICATION_FAILED,
      run.publicationFailureSummary,
    );
    expect(loggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'npm_publication_failed',
        runId,
        designSystemId,
        packageName: '@kolibri/ui',
        packageVersion: '1.0.0',
        command: 'npm publish --ignore-scripts',
        exitCode: 1,
        stderr: 'npm ERR! code E403\n_authToken=[REDACTED]',
      }),
    );
  });

  it('uses the generic safe publication failure when the error has no displayable detail', async () => {
    publishVersion.mockRejectedValueOnce({});
    await service.queue(owner, designSystemId, true);
    await scheduledTask?.();
    expect(run.publicationFailureSummary).toBe(
      'The package was generated, but npm publication failed. Check the npm configuration and try again.',
    );
  });

  it('returns only an owner-scoped run status view', async () => {
    run.status = GenerationRunStatus.RUNNING;
    await expect(service.getOwnedRun(owner, runId)).resolves.toMatchObject({
      id: runId,
      designSystemId,
      status: GenerationRunStatus.RUNNING,
    });
    expect(runFindOne).toHaveBeenCalledWith({
      where: { id: runId, designSystem: { ownerId: owner.userReferenceId } },
    });
    const result = await service.getOwnedRun(owner, runId);
    expect(result).not.toHaveProperty('designSystem');
  });

  it('resolves package access only after enforcing run ownership', async () => {
    run.status = GenerationRunStatus.SUCCEEDED;
    run.artifactReference = `local:runs/${runId}/download/kolibri-ui.zip`;

    await expect(
      service.getArtifactAccess(owner, runId),
    ).resolves.toMatchObject({ kind: 'redirect', expiresInSeconds: 300 });
    expect(resolveArtifactAccess).toHaveBeenCalledWith(run.artifactReference);

    resolveArtifactAccess.mockClear();
    runFindOne.mockResolvedValueOnce(null);
    await expect(
      service.getArtifactAccess(owner, runId),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(resolveArtifactAccess).not.toHaveBeenCalled();
  });

  it('rejects artifact access before completion and when the reference is absent', async () => {
    await expect(
      service.getArtifactAccess(owner, runId),
    ).rejects.toBeInstanceOf(NotFoundException);
    run.status = GenerationRunStatus.SUCCEEDED;
    await expect(
      service.getArtifactAccess(owner, runId),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('reports a generic runtime failure when generation stops before any named step', async () => {
    await service.queue(owner, designSystemId);
    recordEvent.mockRejectedValueOnce(new Error('event store unavailable'));
    await scheduledTask?.();

    expect(run.status).toBe(GenerationRunStatus.FAILED);
    expect(recordEvent).toHaveBeenCalledWith(
      runId,
      GENERATION_PHASES.DIAGNOSTIC_ERROR,
      'GENERATION_RUNTIME_FAILED — Generation stopped unexpectedly.',
    );
  });

  it('records diagnostics with control characters, blank fields and no location safely', async () => {
    importDesignSystem.mockReturnValue({
      tokens: [],
      fontSources: [],
      imageReferences: [],
      components: [],
      diagnostics: [
        { severity: 'warning', code: '\u0000', message: '\u001f\u007f' },
        {
          severity: 'warning',
          code: 'CODE\u0007X',
          message: 'line\u0001break',
          component: 'Card\u007fName',
          nodeId: '9:9',
        },
      ],
    });
    await service.queue(owner, designSystemId);
    await scheduledTask?.();

    expect(recordEvent).toHaveBeenCalledWith(
      runId,
      GENERATION_PHASES.DIAGNOSTIC_WARNING,
      'GENERATION_DIAGNOSTIC — Generation diagnostic',
    );
    expect(recordEvent).toHaveBeenCalledWith(
      runId,
      GENERATION_PHASES.DIAGNOSTIC_WARNING,
      'CODE X — line break — Component: Card Name — Node: 9:9',
    );
  });
});
