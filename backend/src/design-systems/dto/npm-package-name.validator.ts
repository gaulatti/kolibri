import type { ValidationOptions } from 'class-validator';
import {
  registerDecorator,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import validateNpmPackageName from 'validate-npm-package-name';

@ValidatorConstraint({ name: 'isNpmPackageName', async: false })
export class NpmPackageNameConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return (
      typeof value === 'string' &&
      validateNpmPackageName(value).validForNewPackages
    );
  }

  defaultMessage(): string {
    return 'packageName must be a valid npm package name';
  }
}

export function IsNpmPackageName(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return (target, propertyKey) => {
    registerDecorator({
      target: target.constructor,
      propertyName: propertyKey.toString(),
      options: validationOptions,
      validator: NpmPackageNameConstraint,
    });
  };
}
