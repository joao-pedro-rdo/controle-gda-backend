import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { badRequest, internal } from "../../lib/errors.js";
import { setupErrorHandler } from "../../lib/error-handler.js";

function createApp(): FastifyInstance {
  const app = Fastify({ logger: false });
  setupErrorHandler(app);

  app.get("/app-error", async () => {
    throw badRequest("Placa inválida");
  });

  app.get("/zod-error", async () => {
    const schema = z.object({ login: z.string() });
    schema.parse({ login: 42 });
  });

  app.get("/generic-error", async () => {
    throw new Error("erro inesperado");
  });

  app.get("/prisma-conflict", async () => {
    const error = new Error("Unique constraint failed") as Error & {
      code: string;
    };
    error.code = "P2002";
    throw error;
  });

  app.get("/prisma-not-found", async () => {
    const error = new Error("Record not found") as Error & { code: string };
    error.code = "P2025";
    throw error;
  });

  app.get("/internal-app-error", async () => {
    throw internal("falha interna no banco");
  });

  return app;
}

describe("setupErrorHandler", () => {
  let app: FastifyInstance;

  beforeAll(() => {
    app = createApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns a consistent shape for AppError", async () => {
    const response = await app.inject({ method: "GET", url: "/app-error" });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      statusCode: 400,
      code: "BAD_REQUEST",
      error: "Placa inválida",
      message: "Placa inválida",
    });
  });

  it("maps ZodError to 400 with field details", async () => {
    const response = await app.inject({ method: "GET", url: "/zod-error" });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(body.details).toEqual([
      { field: "login", message: "Expected string, received number" },
    ]);
  });

  it("maps unknown errors to 500", async () => {
    const response = await app.inject({ method: "GET", url: "/generic-error" });

    expect(response.statusCode).toBe(500);
    expect(response.json().code).toBe("INTERNAL_ERROR");
    expect(response.json().message).toBe("Erro interno do servidor");
  });

  it("maps Prisma P2002 to 409 CONFLICT", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/prisma-conflict",
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().code).toBe("CONFLICT");
  });

  it("maps Prisma P2025 to 404 NOT_FOUND", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/prisma-not-found",
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().code).toBe("NOT_FOUND");
  });

  it("hides the message of server AppErrors in production", async () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    const productionApp = createApp();
    try {
      const response = await productionApp.inject({
        method: "GET",
        url: "/internal-app-error",
      });

      expect(response.statusCode).toBe(500);
      expect(response.json().message).toBe("Erro interno do servidor");
    } finally {
      process.env.NODE_ENV = previous;
      await productionApp.close();
    }
  });

  it("uses a consistent not-found handler", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/rota-inexistente",
    });

    expect(response.statusCode).toBe(404);
    const body = response.json();
    expect(body.statusCode).toBe(404);
    expect(body.code).toBe("NOT_FOUND");
    expect(body.message).toContain("/rota-inexistente");
  });
});
