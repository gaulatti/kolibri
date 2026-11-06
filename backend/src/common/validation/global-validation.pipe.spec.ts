import { IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ArgumentMetadata, BadRequestException } from '@nestjs/common';
import {
  createGlobalValidationPipe,
  validationException,
} from './global-validation.pipe';

class Inner {
  @IsString()
  label!: string;
}

class Outer {
  @ValidateNested()
  @Type(() => Inner)
  inner!: Inner;

  @IsString()
  name!: string;
}

const metadata: ArgumentMetadata = { type: 'body', metatype: Outer };

describe('global validation pipe', () => {
  it('reports nested failures with dotted field paths', async () => {
    const pipe = createGlobalValidationPipe();
    let failure: BadRequestException | undefined;
    try {
      await pipe.transform({ inner: { label: 3 }, name: 'ok' }, metadata);
    } catch (error) {
      failure = error as BadRequestException;
    }
    expect(failure?.getResponse()).toMatchObject({
      code: 'VALIDATION_ERROR',
      errors: [{ field: 'inner.label', messages: ['label must be a string'] }],
    });
  });

  it('reports top-level failures without a prefix', () => {
    const exception = validationException([
      { property: 'name', constraints: { isString: 'name must be a string' } },
    ]);
    expect(exception.getResponse()).toMatchObject({
      errors: [{ field: 'name', messages: ['name must be a string'] }],
    });
  });

  it('flattens an error that has neither constraints nor children', () => {
    const exception = validationException([{ property: 'name' }]);
    expect(exception.getResponse()).toMatchObject({ errors: [] });
  });
});
