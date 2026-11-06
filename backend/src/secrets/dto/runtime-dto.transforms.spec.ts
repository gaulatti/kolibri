import { plainToInstance } from 'class-transformer';
import { SetDesignSystemRuntimeConfigurationDto } from './set-design-system-runtime-configuration.dto';
import { SetDesignSystemRuntimeCredentialsDto } from './set-design-system-runtime-credentials.dto';

const configuration = (body: Record<string, unknown>) =>
  plainToInstance(SetDesignSystemRuntimeConfigurationDto, body);

describe('runtime configuration DTO normalization', () => {
  it('extracts the file key from Figma design, file and board URLs', () => {
    expect(
      configuration({
        figmaFileKey: 'https://www.figma.com/design/AbC123/Name?node-id=1',
      }).figmaFileKey,
    ).toBe('AbC123');
    expect(
      configuration({ figmaFileKey: 'https://figma.com/file/k%2D9/x' })
        .figmaFileKey,
    ).toBe('k-9');
  });

  it('keeps a Figma URL whose path has no file key unchanged', () => {
    expect(
      configuration({ figmaFileKey: ' https://www.figma.com/files/recent ' })
        .figmaFileKey,
    ).toBe('https://www.figma.com/files/recent');
  });

  it('keeps URLs on other hosts and plain keys, trimmed', () => {
    expect(
      configuration({ figmaFileKey: 'https://example.com/design/abc' })
        .figmaFileKey,
    ).toBe('https://example.com/design/abc');
    expect(configuration({ figmaFileKey: '  plainKey  ' }).figmaFileKey).toBe(
      'plainKey',
    );
  });

  it('passes non-string values through for validation to reject', () => {
    expect(configuration({ figmaFileKey: 42 }).figmaFileKey).toBe(42);
    expect(configuration({ packageName: 42 }).packageName).toBe(42);
    expect(configuration({ packageName: ' @acme/ui ' }).packageName).toBe(
      '@acme/ui',
    );
  });

  it('trims credential strings and passes other values through', () => {
    const credentials = plainToInstance(SetDesignSystemRuntimeCredentialsDto, {
      figmaAccessToken: ' token ',
      npmToken: 7,
    });
    expect(credentials.figmaAccessToken).toBe('token');
    expect(credentials.npmToken).toBe(7);
  });
});
