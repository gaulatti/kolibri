import { createGlobalValidationPipe } from './global-validation.pipe';
import { CreateDesignSystemDto } from '../../design-systems/dto/create-design-system.dto';
import { GenerationHistoryQueryDto } from '../../generation/dto/generation-history-query.dto';
import { SetDesignSystemRuntimeConfigurationDto } from '../../secrets/dto/set-design-system-runtime-configuration.dto';
import { SetDesignSystemRuntimeCredentialsDto } from '../../secrets/dto/set-design-system-runtime-credentials.dto';

describe('request value type boundaries', () => {
  it.each([
    [CreateDesignSystemDto, { name: 123 }],
    [
      GenerationHistoryQueryDto,
      { text: 123, status: false, sortDirection: true },
    ],
    [
      SetDesignSystemRuntimeConfigurationDto,
      { figmaFileKey: 123, packageName: 123 },
    ],
    [
      SetDesignSystemRuntimeCredentialsDto,
      { figmaAccessToken: 123, npmToken: false },
    ],
  ])(
    'rejects non-string request fields without coercing them into credentials or configuration',
    async (metatype, body) => {
      await expect(
        createGlobalValidationPipe().transform(body, {
          type: 'body',
          metatype,
        }),
      ).rejects.toMatchObject({
        response: { code: 'VALIDATION_ERROR', statusCode: 400 },
      });
    },
  );

  it('normalizes valid Figma URLs to file keys before saving runtime configuration', async () => {
    await expect(
      createGlobalValidationPipe().transform(
        {
          figmaFileKey: ' https://www.figma.com/design/File_123/example ',
          packageName: ' @fixture/ui ',
        },
        { type: 'body', metatype: SetDesignSystemRuntimeConfigurationDto },
      ),
    ).resolves.toEqual({
      figmaFileKey: 'File_123',
      packageName: '@fixture/ui',
    });
  });

  it.each([
    'https://other.example/design/File_123',
    'https://figma.com/no-file-key',
    'https://figma.com/file/%invalid',
  ])(
    'rejects unsupported or malformed source URLs %s',
    async (figmaFileKey) => {
      await expect(
        createGlobalValidationPipe().transform(
          { figmaFileKey, packageName: '@fixture/ui' },
          {
            type: 'body',
            metatype: SetDesignSystemRuntimeConfigurationDto,
          },
        ),
      ).rejects.toMatchObject({
        response: { code: 'VALIDATION_ERROR', statusCode: 400 },
      });
    },
  );
});
