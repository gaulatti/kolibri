import { runtimeMode } from './runtime-mode';

describe('runtimeMode', () => {
  it('defaults by Node environment', () => {
    expect(runtimeMode({ NODE_ENV: 'development' })).toBe('local');
    expect(runtimeMode({ NODE_ENV: 'test' })).toBe('local');
    expect(runtimeMode({ NODE_ENV: 'production' })).toBe('production');
  });

  it('allows development to use production providers explicitly', () => {
    expect(
      runtimeMode({
        NODE_ENV: 'development',
        KOLIBRI_RUNTIME_MODE: 'production',
      }),
    ).toBe('production');
  });

  it('rejects unknown modes', () => {
    expect(() => runtimeMode({ KOLIBRI_RUNTIME_MODE: 'hybrid' })).toThrow(
      'KOLIBRI_RUNTIME_MODE',
    );
  });
});
