import { BadRequestException } from '@nestjs/common';
import type { ArgumentMetadata } from '@nestjs/common';
import {
  createGlobalValidationPipe,
  emptyUpdateException,
  type ValidationIssue,
} from '../common/validation/global-validation.pipe';
import { CreateDesignSystemDto } from './dto/create-design-system.dto';
import { DesignSystemIdParams } from './dto/design-system-id.params';

const bodyMetadata: ArgumentMetadata = {
  type: 'body',
  metatype: CreateDesignSystemDto,
};

type ValidationResponse = {
  statusCode: number;
  code: string;
  message: string;
  errors: ValidationIssue[];
};

async function validationFailure(
  operation: Promise<unknown>,
): Promise<ValidationResponse> {
  try {
    await operation;
  } catch (error) {
    if (!(error instanceof BadRequestException)) throw error;
    const response = error.getResponse();
    if (typeof response === 'string') throw error;
    return response as ValidationResponse;
  }
  throw new Error('Expected request validation to fail');
}

describe('design-system request validation', () => {
  it('creates a structured empty-update validation response', () => {
    expect(emptyUpdateException().getResponse()).toMatchObject({
      code: 'VALIDATION_ERROR',
      errors: [{ field: 'body' }],
    });
  });
  it('transforms and trims a valid create request', async () => {
    const pipe = createGlobalValidationPipe();
    await expect(
      pipe.transform(
        {
          name: '  Kolibri UI  ',
          description: '  Shared application components  ',
        },
        bodyMetadata,
      ),
    ).resolves.toEqual({
      name: 'Kolibri UI',
      description: 'Shared application components',
    });
  });

  it('returns structured safe errors for invalid and unexpected properties', async () => {
    const pipe = createGlobalValidationPipe();

    const response = await validationFailure(
      pipe.transform(
        {
          name: ' ',
          ownerId: 'do-not-accept-owner-input',
          figmaToken: 'must-not-appear-in-the-error',
        },
        bodyMetadata,
      ),
    );
    expect(response).toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
    });
    expect(response.errors.map((error) => error.field)).toEqual(
      expect.arrayContaining(['ownerId', 'figmaToken', 'name']),
    );
    expect(JSON.stringify(response)).not.toContain(
      'must-not-appear-in-the-error',
    );
  });

  it('validates design-system IDs as UUID v4 values', async () => {
    const pipe = createGlobalValidationPipe();
    const response = await validationFailure(
      pipe.transform(
        { id: 'not-a-uuid' },
        { type: 'param', metatype: DesignSystemIdParams },
      ),
    );
    expect(response.code).toBe('VALIDATION_ERROR');
    expect(response.errors.map((error) => error.field)).toEqual(['id']);
  });
});
