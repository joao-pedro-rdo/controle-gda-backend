import type { ZodType, ZodTypeDef } from "zod";

import { fromZodError } from "./errors.js";

function parse<Output>(
  schema: ZodType<Output, ZodTypeDef, any>,
  value: unknown
): Output {
  const result = schema.safeParse(value);
  if (!result.success) throw fromZodError(result.error);
  return result.data;
}

export function parseBody<Output>(
  schema: ZodType<Output, ZodTypeDef, any>,
  body: unknown
): Output {
  return parse(schema, body);
}

export function parseParams<Output>(
  schema: ZodType<Output, ZodTypeDef, any>,
  params: unknown
): Output {
  return parse(schema, params);
}

export function parseQuery<Output>(
  schema: ZodType<Output, ZodTypeDef, any>,
  query: unknown
): Output {
  return parse(schema, query);
}
