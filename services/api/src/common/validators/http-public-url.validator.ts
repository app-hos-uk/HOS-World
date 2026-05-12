import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { isValidHttpPublicUrl } from '@hos-marketplace/utils';

@ValidatorConstraint({ name: 'isHttpPublicUrl', async: false })
class IsHttpPublicUrlConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (value == null || value === '') return true;
    if (typeof value !== 'string') return false;
    return isValidHttpPublicUrl(value);
  }

  defaultMessage(args?: ValidationArguments) {
    return `${String(args?.property ?? 'URL')} must be a valid https:// URL with a proper hostname (e.g. https://cdn.example.com/file.png)`;
  }
}

export function IsHttpPublicUrl(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isHttpPublicUrl',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: IsHttpPublicUrlConstraint,
    });
  };
}
