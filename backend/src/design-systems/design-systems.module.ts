import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DesignSystem } from '../persistence/entities';
import { SecretsModule } from '../secrets/secrets.module';
import { StorageModule } from '../storage/storage.module';
import { DesignSystemsController } from './design-systems.controller';
import { DesignSystemsService } from './design-systems.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([DesignSystem]),
    SecretsModule,
    StorageModule,
  ],
  controllers: [DesignSystemsController],
  providers: [DesignSystemsService],
  exports: [DesignSystemsService],
})
export class DesignSystemsModule {}
