import type { ZodType } from "zod";

import { fromZodError } from "./errors.js";

function parse<T>(schema: ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw fromZodError(result.error);
  return result.data;
}

export function parseBody<T>(schema: ZodType<T>, body: unknown): T {
  return parse(schema, body);
}

export function parseParams<T>(schema: ZodType<T>, params: unknown): T {
  return parse(schema, params);
}

export function parseQuery<T>(schema: ZodType<T>, query: unknown): T {
  return parse(schema, query);
}
