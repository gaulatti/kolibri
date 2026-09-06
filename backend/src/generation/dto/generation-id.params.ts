import { IsUUID } from 'class-validator';

export class GenerationIdParams {
  @IsUUID('4')
  id!: string;
}
