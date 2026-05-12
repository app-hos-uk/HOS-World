import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
  registerDecorator,
  ValidationOptions,
} from 'class-validator';

/** Optional string: when non-empty after trim, must include a letter (Unicode) and not be digits-only. */
export function OptionalLabelRequiresLetters(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'optionalLabelRequiresLetters',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: OptionalLabelRequiresLettersConstraint,
    });
  };
}

@ValidatorConstraint({ name: 'optionalLabelRequiresLetters', async: false })
class OptionalLabelRequiresLettersConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (value == null || value === '') return true;
    if (typeof value !== 'string') return false;
    const t = value.trim();
    if (!t.length) return true;
    if (/^\d+$/.test(t) || /^\p{Nd}+$/u.test(t)) return false;
    return /\p{L}/u.test(t);
  }

  defaultMessage(args?: ValidationArguments) {
    return `${args?.property ?? 'Field'} must include letters and cannot be numeric-only (digits in any script)`;
  }
}

/** Optional phone: digits/spaces/formatting chars only; 7–15 digits when provided. */
export function OptionalOperationsPhone(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'optionalOperationsPhone',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: OptionalOperationsPhoneConstraint,
    });
  };
}

@ValidatorConstraint({ name: 'optionalOperationsPhone', async: false })
class OptionalOperationsPhoneConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (value == null || value === '') return true;
    if (typeof value !== 'string') return false;
    const t = value.trim().replace(/\u00a0/g, ' ');
    if (!t.length) return true;
    if (!/^[\d\s\-+().]+$/.test(t)) return false;
    const digits = t.replace(/\D/g, '');
    return digits.length >= 7 && digits.length <= 15;
  }

  defaultMessage(args?: ValidationArguments) {
    return `${args?.property ?? 'Phone'} may only contain digits and + ( ) space - ., with 7–15 digits`;
  }
}

/** Optional postal/ZIP: alphanumeric + space/hyphen, at least one digit (filters letter-only gibberish). */
export function OptionalPostalCodeMixed(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'optionalPostalCodeMixed',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: OptionalPostalCodeMixedConstraint,
    });
  };
}

@ValidatorConstraint({ name: 'optionalPostalCodeMixed', async: false })
class OptionalPostalCodeMixedConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (value == null || value === '') return true;
    if (typeof value !== 'string') return false;
    const t = value.trim();
    if (!t.length) return true;
    if (!/^[\p{L}\p{N}](?:[\p{L}\p{N}\s\-]{0,13}[\p{L}\p{N}])?$/u.test(t)) return false;
    return /\p{Nd}/u.test(t);
  }

  defaultMessage(args?: ValidationArguments) {
    return `${args?.property ?? 'Postal code'} must use letters or digits with optional spaces/hyphens (2–15 chars) and include at least one numeric digit`;
  }
}
