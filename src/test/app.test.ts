import type { FastifyInstance } from "fastify";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ up: true }));

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    async $queryRaw() {
      if (!db.up) throw Object.assign(new Error("Can't reach database"), { errorCode: "P1001" });
      return [{ "?column?": 1 }];
    },
  },
}));

vi.mock("../repositories/user-repository.js", () => ({
  prismaUserRepository: {
    async findById(id: number) {
      return { id, login: "guarda", role: "Guarda" };
    },
  },
}));

import { signAccessToken } from "../lib/auth.js";
import { normalizePath } from "../middleware/prometheus-metrics.js";
import { readSurveillanceConfig } from "../routes/surveillance-routes.js";
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
    expect(payload.database).toBe("ok");
  });

  it("reports 503 on the healthcheck when the database is down", async () => {
    db.up = false;
    try {
      const response = await app.inject({ method: "GET", url: "/health" });

      expect(response.statusCode).toBe(503);
      expect(response.json()).toMatchObject({ status: "degraded", database: "unavailable" });
    } finally {
      db.up = true;
    }
  });

  it("exposes Prometheus metrics", async () => {
    const response = await app.inject({ method: "GET", url: "/metrics" });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toMatch(/text\/plain/);
    expect(response.body).toContain("http_requests_total");
  });

  describe("surveillance", () => {
    const guardaToken = signAccessToken({ id: 2, login: "guarda", role: "Guarda" });

    afterEach(() => {
      delete process.env.SURVEILLANCE_API_URL;
      delete process.env.SURVEILLANCE_API_CAMERA;
    });

    it("requires authentication", async () => {
      const response = await app.inject({ method: "GET", url: "/surveillance/latest-photo" });
      expect(response.statusCode).toBe(401);
    });

    it("returns 503 when the camera is not configured", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/surveillance/latest-photo",
        cookies: { accessToken: guardaToken },
      });

      expect(response.statusCode).toBe(503);
      expect(response.json().code).toBe("SURVEILLANCE_NOT_CONFIGURED");
    });

    it("reads the camera config with a default timeout", () => {
      expect(readSurveillanceConfig({})).toBeNull();
      expect(
        readSurveillanceConfig({ SURVEILLANCE_API_URL: "https://cam/", SURVEILLANCE_API_CAMERA: "recepcao" })
      ).toMatchObject({ url: "https://cam", camera: "recepcao", timeoutMs: 5000, insecureTls: true });
      expect(
        readSurveillanceConfig({
          SURVEILLANCE_API_URL: "https://cam",
          SURVEILLANCE_API_CAMERA: "x",
          SURVEILLANCE_TIMEOUT_MS: "1500",
          SURVEILLANCE_TLS_INSECURE: "false",
        })
      ).toMatchObject({ timeoutMs: 1500, insecureTls: false });
    });
  });

  it.each([
    ["/vehicles/123", "/vehicles/:id"],
    ["/entries/scheduled/7/confirm", "/entries/scheduled/:id/confirm"],
    ["/images/visitors/abc.jpg.encrypted", "/images/visitors/:filename"],
    ["/vehicles?x=1", "/vehicles"],
  ])("normalizes metric path %s", (path, expected) => {
    expect(normalizePath(path)).toBe(expected);
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
