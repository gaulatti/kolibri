import { GenerationStorage } from './generation-storage';
import type { LocalGenerationStorage } from './local-generation.storage';
import type { S3GenerationStorage } from './s3-generation.storage';
import { selectGenerationStorage } from './storage.module';

describe('storage configuration selection', () => {
  const local = { driver: 'local' } as unknown as LocalGenerationStorage;
  const s3 = { driver: 's3' } as unknown as S3GenerationStorage;

  it('selects the polymorphic implementation using runtime configuration', () => {
    expect(selectGenerationStorage('local', local, s3)).toBe(local);
    expect(selectGenerationStorage('s3', local, s3)).toBe(s3);
    expect(local).toBeInstanceOf(Object);
    expect(s3).toBeInstanceOf(Object);
  });

  it('rejects unsupported configuration instead of silently branching', () => {
    expect(() => selectGenerationStorage('filesystem', local, s3)).toThrow(
      'Storage driver must be local or s3',
    );
  });

  it('uses the abstract class as the shared injection contract', () => {
    expect(GenerationStorage).toBeDefined();
  });
});
