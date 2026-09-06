import { BadRequestException, ValidationPipe } from '@nestjs/common';
import type { ValidationError } from 'class-validator';

export type ValidationIssue = {
  field: string;
  messages: string[];
};

export function createGlobalValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
    forbidUnknownValues: true,
    validationError: { target: false, value: false },
    exceptionFactory: (errors) => validationException(errors),
  });
}

export function validationException(
  errors: ValidationError[],
): BadRequestException {
  return new BadRequestException({
    statusCode: 400,
    code: 'VALIDATION_ERROR',
    message: 'Request validation failed',
    errors: flattenErrors(errors),
  });
}

export function emptyUpdateException(): BadRequestException {
  return new BadRequestException({
    statusCode: 400,
    code: 'VALIDATION_ERROR',
    message: 'Request validation failed',
    errors: [
      {
        field: 'body',
        messages: ['at least one updatable property is required'],
      },
    ],
  });
}

function flattenErrors(
  errors: ValidationError[],
  parent = '',
): ValidationIssue[] {
  return errors.flatMap((error) => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const current = error.constraints
      ? [{ field, messages: Object.values(error.constraints) }]
      : [];
    return [...current, ...flattenErrors(error.children ?? [], field)];
  });
}
