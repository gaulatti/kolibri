import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import { IsNpmPackageName } from '../../design-systems/dto/npm-package-name.validator';

const Trim = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );

export class SetDesignSystemRuntimeConfigurationDto {
  @Transform(({ value }: { value: unknown }) => normalizeFigmaFileKey(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Matches(/^(?!figd_)[A-Za-z0-9_-]+$/i, {
    message:
      'figmaFileKey must be a Figma file key or URL, not an access token',
  })
  figmaFileKey!: string;

  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(214)
  @IsNpmPackageName()
  packageName!: string;
}

function normalizeFigmaFileKey(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  try {
    const url = new URL(trimmed);
    if (!/(^|\.)figma\.com$/i.test(url.hostname)) return trimmed;
    const match = url.pathname.match(/^\/(?:file|design|board)\/([^/]+)/i);
    return match?.[1] ? decodeURIComponent(match[1]) : trimmed;
  } catch {
    return trimmed;
  }
}
