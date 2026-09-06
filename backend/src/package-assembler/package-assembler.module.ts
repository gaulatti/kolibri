import { Module } from '@nestjs/common';
import { PackageAssemblerService } from './package-assembler.service';

@Module({
  providers: [PackageAssemblerService],
  exports: [PackageAssemblerService],
})
export class PackageAssemblerModule {}
