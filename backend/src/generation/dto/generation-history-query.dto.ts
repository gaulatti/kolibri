import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { GenerationRunStatus } from '../../persistence/entities';

export enum HistorySortDirection {
  ASC = 'asc',
  DESC = 'desc',
}

const trimmed = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const lowerTrimmed = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class GenerationHistoryQueryDto {
  @IsOptional()
  @Transform(trimmed)
  @IsUUID('4')
  designSystemId?: string;

  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  text?: string;

  @IsOptional()
  @Transform(lowerTrimmed)
  @IsEnum(GenerationRunStatus)
  status?: GenerationRunStatus;

  @IsOptional()
  @Transform(trimmed)
  @IsISO8601({ strict: true })
  startDate?: string;

  @IsOptional()
  @Transform(trimmed)
  @IsISO8601({ strict: true })
  endDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 25;

  @IsOptional()
  @Transform(lowerTrimmed)
  @IsEnum(HistorySortDirection)
  sortDirection = HistorySortDirection.DESC;
}
