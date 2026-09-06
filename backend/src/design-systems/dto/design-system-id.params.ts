import { IsUUID } from 'class-validator';

export class DesignSystemIdParams {
  @IsUUID('4', { message: 'id must be a valid UUID' })
  id!: string;
}
