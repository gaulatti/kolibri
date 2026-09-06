import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { loadRuntimeDatabaseOptions } from './database.config';
import { PERSISTENCE_ENTITIES } from './persistence.entities';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => loadRuntimeDatabaseOptions(process.env),
    }),
    TypeOrmModule.forFeature(PERSISTENCE_ENTITIES),
  ],
  exports: [TypeOrmModule],
})
export class PersistenceModule {}
