import { Module } from '@nestjs/common';
import { SystemConfigurationService } from './system-configuration.service';

@Module({
  providers: [SystemConfigurationService],
  exports: [SystemConfigurationService],
})
export class SystemConfigurationModule {}
