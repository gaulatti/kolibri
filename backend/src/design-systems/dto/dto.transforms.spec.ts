import { plainToInstance } from 'class-transformer';
import { Trim } from './dto.transforms';

class Sample {
  @Trim()
  value!: unknown;
}

describe('Trim transform', () => {
  it('trims strings and leaves other values untouched', () => {
    expect(plainToInstance(Sample, { value: '  x  ' }).value).toBe('x');
    expect(plainToInstance(Sample, { value: 7 }).value).toBe(7);
    expect(plainToInstance(Sample, { value: null }).value).toBeNull();
  });
});
