import type { FastifyInstance } from "fastify";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("../../repositories/user-repository.js", () => {
  const users = [
    { id: 1, login: "s2", role: "S2" },
    { id: 2, login: "guarda", role: "Guarda" },
  ];
  return {
    prismaUserRepository: {
      async findMany() {
        return users;
      },
      async findById(id: number) {
        return users.find((user) => user.id === id) ?? null;
      },
    },
  };
});

import { requireGuardaRole, signAccessToken } from "../../lib/auth.js";
import { createTestApp } from "../helpers/create-test-app.js";

const STATION_IP = "10.20.30.40";
const OTHER_IP = "10.20.30.99";
const PROXY_IP = "172.18.0.5";

const STATION_SESSION = {
  authenticated: true,
  user: { id: 0, login: "posto-guarda", role: "Guarda", station: true },
};

async function buildAppWith(env: { trustProxy?: string }) {
  if (env.trustProxy === undefined) delete process.env.TRUST_PROXY;
  else process.env.TRUST_PROXY = env.trustProxy;

  const app = await createTestApp();
  app.get("/__test/guarda", { preHandler: requireGuardaRole }, async (request) => ({
    user: request.user,
  }));
  await app.ready();
  return app;
}

describe("guard station (IP allowlist)", () => {
  const originalIps = process.env.GUARDA_TRUSTED_IPS;
  const originalProxy = process.env.TRUST_PROXY;

  beforeAll(() => {
    process.env.GUARDA_TRUSTED_IPS = `${STATION_IP}, 10.99.0.0/24`;
  });

  afterAll(() => {
    if (originalIps === undefined) delete process.env.GUARDA_TRUSTED_IPS;
    else process.env.GUARDA_TRUSTED_IPS = originalIps;
    if (originalProxy === undefined) delete process.env.TRUST_PROXY;
    else process.env.TRUST_PROXY = originalProxy;
  });

  describe("direct connection (TRUST_PROXY unset)", () => {
    let app: FastifyInstance;

    beforeAll(async () => {
      app = await buildAppWith({});
    });

    afterAll(async () => {
      await app.close();
    });

    it("returns a Guarda session for an allowed IP without cookie", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/auth/check",
        remoteAddress: STATION_IP,
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(STATION_SESSION);
    });

    it("matches allowed CIDR ranges", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/auth/check",
        remoteAddress: "10.99.0.12",
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().user.station).toBe(true);
    });

    it("rejects IPs outside the allowlist", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/auth/check",
        remoteAddress: OTHER_IP,
      });

      expect(response.statusCode).toBe(401);
    });

    it("ignores a forged X-Forwarded-For when no proxy is trusted", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/auth/check",
        remoteAddress: OTHER_IP,
        headers: { "x-forwarded-for": STATION_IP },
      });

      expect(response.statusCode).toBe(401);
    });

    it("prefers a valid login over the station session", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/auth/check",
        remoteAddress: STATION_IP,
        cookies: { accessToken: signAccessToken({ id: 1, login: "s2", role: "S2" }) },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        authenticated: true,
        user: { id: 1, login: "s2", role: "S2" },
      });
    });

    it("falls back to the station session when the cookie is invalid", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/auth/check",
        remoteAddress: STATION_IP,
        cookies: { accessToken: "token-invalido" },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(STATION_SESSION);
    });

    it("still rejects an invalid cookie outside the station", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/auth/check",
        remoteAddress: OTHER_IP,
        cookies: { accessToken: "token-invalido" },
      });

      expect(response.statusCode).toBe(401);
    });

    it("lets the station use Guarda routes", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/__test/guarda",
        remoteAddress: STATION_IP,
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().user.role).toBe("Guarda");
    });

    it("does not give the station S2 permissions", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/users",
        remoteAddress: STATION_IP,
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe("behind one trusted proxy (TRUST_PROXY=1)", () => {
    let app: FastifyInstance;

    beforeAll(async () => {
      app = await buildAppWith({ trustProxy: "1" });
    });

    afterAll(async () => {
      await app.close();
    });

    it("uses the client IP appended by the proxy", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/auth/check",
        remoteAddress: PROXY_IP,
        headers: { "x-forwarded-for": STATION_IP },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(STATION_SESSION);
    });

    it("ignores addresses the client prepended to X-Forwarded-For", async () => {
      // Nginx acrescenta o IP real ao final do cabeçalho enviado pelo cliente.
      const response = await app.inject({
        method: "GET",
        url: "/auth/check",
        remoteAddress: PROXY_IP,
        headers: { "x-forwarded-for": `${STATION_IP}, ${OTHER_IP}` },
      });

      expect(response.statusCode).toBe(401);
    });

    it("does not treat the proxy itself as a station", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/auth/check",
        remoteAddress: PROXY_IP,
        headers: { "x-forwarded-for": OTHER_IP },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("configuration errors", () => {
    afterEach(() => {
      process.env.GUARDA_TRUSTED_IPS = `${STATION_IP}, 10.99.0.0/24`;
      delete process.env.TRUST_PROXY;
    });

    it("refuses to start with an invalid allowlist", async () => {
      process.env.GUARDA_TRUSTED_IPS = "guarita-1";
      await expect(createTestApp()).rejects.toThrow(/GUARDA_TRUSTED_IPS/);
    });

    it("refuses TRUST_PROXY=true", async () => {
      process.env.TRUST_PROXY = "true";
      await expect(createTestApp()).rejects.toThrow(/TRUST_PROXY/);
    });
  });
});
