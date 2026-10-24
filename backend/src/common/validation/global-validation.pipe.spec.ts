import {
  createGlobalValidationPipe,
  validationException,
} from './global-validation.pipe';
import { CreateDesignSystemDto } from '../../design-systems/dto/create-design-system.dto';

describe('validation error responses', () => {
  it('retains nested field paths without disclosing rejected values or targets', () => {
    const exception = validationException([
      {
        property: 'configuration',
        target: { private: 'fixture-value' },
        children: [
          {
            property: 'port',
            value: 'fixture-value',
            constraints: { isInt: 'port must be an integer' },
          },
          {
            property: 'hosts',
            children: [
              { property: '0', constraints: { isUrl: 'host must be a URL' } },
            ],
          },
        ],
      },
      {
        property: 'name',
        constraints: { isNotEmpty: 'name must not be empty' },
        children: [],
      },
    ]);
    expect(exception.getStatus()).toBe(400);
    expect(exception.getResponse()).toEqual({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      errors: [
        { field: 'configuration.port', messages: ['port must be an integer'] },
        { field: 'configuration.hosts.0', messages: ['host must be a URL'] },
        { field: 'name', messages: ['name must not be empty'] },
      ],
    });
    expect(JSON.stringify(exception.getResponse())).not.toContain(
      'fixture-value',
    );
  });

  it('uses the same structured response from the actual global validation pipe', async () => {
    const pipe = createGlobalValidationPipe();
    await expect(
      pipe.transform(
        { name: 'valid', arbitrary: 'fixture-value' },
        {
          type: 'body',
          metatype: CreateDesignSystemDto,
        },
      ),
    ).rejects.toMatchObject({
      response: {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        errors: [
          {
            field: 'arbitrary',
            messages: ['property arbitrary should not exist'],
          },
        ],
      },
    });
  });
});
