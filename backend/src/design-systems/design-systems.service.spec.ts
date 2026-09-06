import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import type { AuthenticatedUser } from '../auth/authenticated-user';
import { DesignSystem } from '../persistence/entities';
import { DesignSystemsService } from './design-systems.service';
import type { DesignSystemSecretsService } from '../secrets/design-system-secrets.service';
import type { GenerationStorage } from '../storage/generation-storage';

const owner: AuthenticatedUser = {
  userReferenceId: 'fd803cd2-fb10-4d16-85ed-d93eb25a8e4f',
  cognitoSub: 'owner-cognito-sub',
};

function record(overrides: Partial<DesignSystem> = {}): DesignSystem {
  return {
    id: 'c1994330-51c5-4104-a54a-c90d940e03b3',
    ownerId: owner.userReferenceId,
    name: 'Kolibri UI',
    description: 'Shared application components',
    generationContract: 'composable-v1',
    lastPublishedVersion: null,
    createdAt: new Date('2026-08-01T12:00:00.000Z'),
    updatedAt: new Date('2026-08-01T12:00:00.000Z'),
    owner: undefined as never,
    generationRuns: [],
    ...overrides,
  };
}

describe('DesignSystemsService', () => {
  const create = jest.fn();
  const save = jest.fn();
  const find = jest.fn();
  const findOne = jest.fn();
  const remove = jest.fn();
  const repository = {
    create,
    save,
    find,
    findOne,
    remove,
  } as unknown as Repository<DesignSystem>;
  const deleteDesignSystemConfiguration = jest
    .fn()
    .mockResolvedValue(undefined);
  const removeRun = jest.fn().mockResolvedValue(undefined);
  const service = new DesignSystemsService(
    repository,
    {
      deleteDesignSystemConfiguration,
    } as unknown as DesignSystemSecretsService,
    {
      removeRun,
    } as unknown as GenerationStorage,
  );

  beforeEach(() => jest.clearAllMocks());

  it('creates a PostgreSQL record owned only by the authenticated user', async () => {
    const input = {
      name: 'Kolibri UI',
      description: 'Shared application components',
    };
    const designSystem = record();
    create.mockReturnValue(designSystem);
    save.mockResolvedValue(designSystem);

    const result = await service.create(owner, input);
    expect(result).toMatchObject(input);
    expect(create).toHaveBeenCalledWith({
      ...input,
      ownerId: owner.userReferenceId,
      generationContract: 'composable-v1',
      lastPublishedVersion: null,
    });
    expect(save).toHaveBeenCalledWith(designSystem);
    expect(result).not.toHaveProperty('ownerId');
  });

  it('lists only records owned by the authenticated user', async () => {
    find.mockResolvedValue([record()]);

    await expect(service.list(owner)).resolves.toHaveLength(1);
    expect(find).toHaveBeenCalledWith({
      where: { ownerId: owner.userReferenceId },
      order: { updatedAt: 'DESC', id: 'ASC' },
    });
  });

  it('updates an owned record without changing ownership', async () => {
    const designSystem = record();
    findOne.mockResolvedValue(designSystem);
    save.mockImplementation((value: DesignSystem) => Promise.resolve(value));

    await expect(
      service.update(owner, designSystem.id, {
        name: 'Updated design system',
        description: 'Updated description',
      }),
    ).resolves.toMatchObject({
      name: 'Updated design system',
      description: 'Updated description',
    });
    expect(findOne).toHaveBeenCalledWith({
      where: { id: designSystem.id, ownerId: owner.userReferenceId },
    });
    expect(designSystem.ownerId).toBe(owner.userReferenceId);
  });

  it('rejects an empty update', async () => {
    await expect(service.update(owner, record().id, {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('returns the same 404 for records owned by another user', async () => {
    findOne.mockResolvedValue(null);

    await expect(
      service.get(owner, '0c94d0cf-9a3f-48b8-b9d5-67b5b9377b53'),
    ).rejects.toEqual(
      expect.objectContaining({
        constructor: NotFoundException,
        message: 'Design system not found',
      }),
    );
    expect(findOne).toHaveBeenCalledWith({
      where: {
        id: '0c94d0cf-9a3f-48b8-b9d5-67b5b9377b53',
        ownerId: owner.userReferenceId,
      },
    });
  });

  it('deletes an owned record using cascading database relationships', async () => {
    const generationRun = {
      id: 'f515082d-5e8b-4309-a52e-1ec6cc4c4627',
      artifactReference: 'local:runs/run/download/kolibri-ui.zip',
    };
    const designSystem = record({ generationRuns: [generationRun as never] });
    findOne.mockResolvedValue(designSystem);
    remove.mockResolvedValue(designSystem);

    await expect(
      service.delete(owner, designSystem.id),
    ).resolves.toBeUndefined();
    expect(findOne).toHaveBeenCalledWith({
      where: { id: designSystem.id, ownerId: owner.userReferenceId },
      relations: { generationRuns: true },
    });
    expect(removeRun).toHaveBeenCalledWith(
      generationRun.id,
      generationRun.artifactReference,
    );
    expect(deleteDesignSystemConfiguration).toHaveBeenCalledWith(
      designSystem.id,
    );
    expect(remove).toHaveBeenCalledWith(designSystem);
  });

  it('returns 404 when deleting an inaccessible record', async () => {
    findOne.mockResolvedValue(null);
    await expect(service.delete(owner, record().id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(remove).not.toHaveBeenCalled();
  });
});
