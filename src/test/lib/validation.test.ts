import { describe, expect, it } from "vitest";
import { z } from "zod";

import { parseBody, parseParams, parseQuery } from "../../lib/validation.js";

const loginSchema = z.object({
  login: z.string().min(1),
  password: z.string().min(6),
});

describe("validation utilities", () => {
  describe("parseBody", () => {
    it("returns typed data for valid bodies", () => {
      const data = parseBody(loginSchema, {
        login: "guarda",
        password: "teste123",
      });

      expect(data.login).toBe("guarda");
    });

    it("throws a 400 VALIDATION_ERROR for invalid bodies", () => {
      try {
        parseBody(loginSchema, { login: "guarda" });
        expect.unreachable();
      } catch (error) {
        expect(error.statusCode).toBe(400);
        expect(error.code).toBe("VALIDATION_ERROR");
        expect(error.details).toContainEqual({
          field: "password",
          message: "Required",
        });
      }
    });
  });

  describe("parseParams", () => {
    const idSchema = z.object({ id: z.coerce.number().int().positive() });

    it("parses and coerces params", () => {
      expect(parseParams(idSchema, { id: "42" })).toEqual({ id: 42 });
    });

    it("rejects invalid params", () => {
      try {
        parseParams(idSchema, { id: "abc" });
        expect.unreachable();
      } catch (error) {
        expect(error.statusCode).toBe(400);
      }
    });
  });

  describe("parseQuery", () => {
    const querySchema = z.object({
      page: z.coerce.number().default(1),
      search: z.string().optional(),
    });

    it("applies defaults", () => {
      expect(parseQuery(querySchema, {})).toEqual({ page: 1, search: undefined });
    });

    it("coerces query values", () => {
      expect(parseQuery(querySchema, { page: "2", search: "abc" })).toEqual({
        page: 2,
        search: "abc",
      });
    });
  });
});
