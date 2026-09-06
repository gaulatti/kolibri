import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import type { AuthenticatedUser } from '../auth/authenticated-user';
import { emptyUpdateException } from '../common/validation/global-validation.pipe';
import { DesignSystem } from '../persistence/entities';
import { DesignSystemSecretsService } from '../secrets/design-system-secrets.service';
import { GenerationStorage } from '../storage/generation-storage';
import {
  toDesignSystemView,
  type DesignSystemView,
} from './design-system.view';
import type { CreateDesignSystemDto } from './dto/create-design-system.dto';
import type { UpdateDesignSystemDto } from './dto/update-design-system.dto';

@Injectable()
export class DesignSystemsService {
  constructor(
    @InjectRepository(DesignSystem)
    private readonly designSystems: Repository<DesignSystem>,
    private readonly secrets: DesignSystemSecretsService,
    private readonly storage: GenerationStorage,
  ) {}

  async create(
    user: AuthenticatedUser,
    input: CreateDesignSystemDto,
  ): Promise<DesignSystemView> {
    const designSystem = this.designSystems.create({
      ownerId: user.userReferenceId,
      name: input.name,
      description: input.description?.trim() || null,
      generationContract: input.generationContract ?? 'composable-v1',
      lastPublishedVersion: null,
    });
    return toDesignSystemView(await this.designSystems.save(designSystem));
  }

  async list(user: AuthenticatedUser): Promise<DesignSystemView[]> {
    const records = await this.designSystems.find({
      where: { ownerId: user.userReferenceId },
      order: { updatedAt: 'DESC', id: 'ASC' },
    });
    return records.map(toDesignSystemView);
  }

  async get(user: AuthenticatedUser, id: string): Promise<DesignSystemView> {
    return toDesignSystemView(await this.findOwned(user, id));
  }

  async update(
    user: AuthenticatedUser,
    id: string,
    input: UpdateDesignSystemDto,
  ): Promise<DesignSystemView> {
    if (Object.keys(input).length === 0) throw emptyUpdateException();
    const designSystem = await this.findOwned(user, id);
    Object.assign(designSystem, input);
    if (input.description !== undefined) {
      designSystem.description = input.description.trim() || null;
    }
    return toDesignSystemView(await this.designSystems.save(designSystem));
  }

  async delete(user: AuthenticatedUser, id: string): Promise<void> {
    const designSystem = await this.designSystems.findOne({
      where: { id, ownerId: user.userReferenceId },
      relations: { generationRuns: true },
    });
    if (!designSystem) throw new NotFoundException('Design system not found');
    await Promise.all(
      designSystem.generationRuns.map((run) =>
        this.storage.removeRun(run.id, run.artifactReference),
      ),
    );
    await this.secrets.deleteDesignSystemConfiguration(designSystem.id);
    // The migration deliberately defines ON DELETE CASCADE from design systems
    // to generation runs, and from runs to events. Deletion is therefore
    // explicit ownership deletion of the complete related generation history.
    await this.designSystems.remove(designSystem);
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
}
