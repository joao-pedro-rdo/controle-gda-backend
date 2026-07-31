import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestApp } from "./helpers/create-test-app.js";

describe("app bootstrap", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("exposes the healthcheck route", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/health",
    });

    expect(response.statusCode).toBe(200);

    const payload = response.json();
    expect(payload.status).toBe("ok");
  });

  it("uses the standardized not-found error handler", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/rota-inexistente",
    });

    expect(response.statusCode).toBe(404);

    const payload = response.json();
    expect(payload.statusCode).toBe(404);
    expect(payload.code).toBe("NOT_FOUND");
    expect(typeof payload.message).toBe("string");
  });
});
