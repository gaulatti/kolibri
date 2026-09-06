import { Module } from '@nestjs/common';
import { FigmaClient } from './figma/figma.client';

@Module({
  providers: [FigmaClient],
  exports: [FigmaClient],
})
export class ClientsModule {}
