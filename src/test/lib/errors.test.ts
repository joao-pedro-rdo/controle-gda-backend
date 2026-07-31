import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  AppError,
  badRequest,
  conflict,
  forbidden,
  fromZodError,
  internal,
  notFound,
  unauthorized,
} from "../../lib/errors.js";

describe("AppError", () => {
  it("carries statusCode, code and message", () => {
    const error = new AppError(409, "CONFLICT", "Placa já cadastrada");

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("AppError");
    expect(error.statusCode).toBe(409);
    expect(error.code).toBe("CONFLICT");
    expect(error.message).toBe("Placa já cadastrada");
  });

  it("exposes the message by default for client errors", () => {
    const error = badRequest("Dados inválidos");
    expect(error.expose).toBe(true);
  });

  it("hides the message by default for server errors", () => {
    const error = internal("Segredo interno");
    expect(error.expose).toBe(false);
  });

  it("supports explicit expose and details", () => {
    const error = notFound("Veículo não encontrado", {
      details: [{ field: "id", message: "não existe" }],
    });

    expect(error.details).toEqual([{ field: "id", message: "não existe" }]);
  });

  it("marks operational errors as statusCode < 500", () => {
    expect(forbidden().isOperational).toBe(true);
    expect(internal().isOperational).toBe(false);
  });
});

describe("error factories", () => {
  it("creates 400 BAD_REQUEST", () => {
    const error = badRequest("Campo obrigatório");
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe("BAD_REQUEST");
  });

  it("creates 401 UNAUTHORIZED", () => {
    const error = unauthorized();
    expect(error.statusCode).toBe(401);
    expect(error.code).toBe("UNAUTHORIZED");
    expect(error.message).toBe("Não autorizado");
  });

  it("creates 403 FORBIDDEN", () => {
    expect(forbidden("Sem permissão").statusCode).toBe(403);
  });

  it("creates 404 NOT_FOUND", () => {
    expect(notFound().statusCode).toBe(404);
  });

  it("creates 409 CONFLICT", () => {
    expect(conflict().statusCode).toBe(409);
  });

  it("creates 500 INTERNAL_ERROR", () => {
    expect(internal().code).toBe("INTERNAL_ERROR");
  });
});

describe("fromZodError", () => {
  it("maps Zod issues to a 400 VALIDATION_ERROR with details", () => {
    const schema = z.object({ login: z.string(), role: z.string() });
    const result = schema.safeParse({ login: 123 });
    expect(result.success).toBe(false);

    if (!result.success) {
      const error = fromZodError(result.error);

      expect(error.statusCode).toBe(400);
      expect(error.code).toBe("VALIDATION_ERROR");
      expect(error.details).toEqual([
        { field: "login", message: "Expected string, received number" },
        { field: "role", message: "Required" },
      ]);
    }
  });
});
