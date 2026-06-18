import { BadRequestException, PipeTransform } from '@nestjs/common';
import { ZodSchema } from 'zod';

/**
 * Validates an incoming payload against a Zod schema, returning the parsed
 * (and typed) value or throwing a 400 with readable field errors.
 */
export class ZodValidationPipe<T> implements PipeTransform {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        issues: result.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      });
    }
    return result.data;
  }
}
