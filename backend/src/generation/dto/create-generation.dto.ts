import { IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class CreateGenerationDto {
  @IsUUID('4')
  designSystemId!: string;

  @IsOptional()
  @IsBoolean()
  publishToNpm?: boolean;
}
