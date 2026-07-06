import { z } from 'zod';

export const bearerTokenSchema = z
  .string()
  .regex(/^Bearer\s+\S+$/i, 'Authorization header must use Bearer token format.');

export function parseWithSchema<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  value: unknown,
): z.infer<TSchema> {
  return schema.parse(value);
}
