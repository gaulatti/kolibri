import { plainToInstance } from 'class-transformer';
import { GenerationHistoryQueryDto } from './generation-history-query.dto';

describe('generation history query normalization', () => {
  it('trims and lower-cases strings but leaves other values for validation', () => {
    const strings = plainToInstance(GenerationHistoryQueryDto, {
      designSystemId: ' abc ',
      status: ' FAILED ',
      sortDirection: ' ASC ',
    });
    expect(strings.designSystemId).toBe('abc');
    expect(strings.status).toBe('failed');
    expect(strings.sortDirection).toBe('asc');

    const others = plainToInstance(GenerationHistoryQueryDto, {
      designSystemId: 7,
      status: 5,
      sortDirection: null,
    });
    expect(others.designSystemId).toBe(7);
    expect(others.status).toBe(5);
    expect(others.sortDirection).toBeNull();
  });
});
