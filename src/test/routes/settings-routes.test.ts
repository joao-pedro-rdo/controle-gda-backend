import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const routeState = vi.hoisted(() => ({
  destinations: [] as { id: number; name: string; isDefault: boolean }[],
  nextId: 1,
}));

vi.mock("../../repositories/settings-repository.js", () => {
  return {
    prismaSettingsRepository: {
      async listDestinations() {
        return routeState.destinations.map((d) => ({ ...d }));
      },
      async createDestination(name: string) {
        if (routeState.destinations.some((d) => d.name === name)) {
          throw { code: "P2002" };
        }
        const row = { id: routeState.nextId++, name, isDefault: false };
        routeState.destinations.push(row);
        return { ...row };
      },
      async deleteDestination(name: string) {
        const index = routeState.destinations.findIndex((d) => d.name === name);
        if (index === -1) throw { code: "P2025" };
        return routeState.destinations.splice(index, 1)[0];
      },
      async deleteCustomDestinations() {
        for (let i = routeState.destinations.length - 1; i >= 0; i--) {
          if (!routeState.destinations[i].isDefault) {
            routeState.destinations.splice(i, 1);
          }
        }
        return { count: 0 };
      },
    },
  };
});

vi.mock("../../repositories/user-repository.js", () => {
  return {
    prismaUserRepository: {
      async findById(id: number) {
        const users: Record<
          number,
          { id: number; login: string; password: string; role: string }
        > = {
          1: { id: 1, login: "s2", password: "x", role: "S2" },
          2: { id: 2, login: "guarda", password: "x", role: "Guarda" },
        };
        return users[id] ?? null;
      },
    },
  };
});

import { signAccessToken } from "../../lib/auth.js";
import { createTestApp } from "../helpers/create-test-app.js";

const s2Token = signAccessToken({ id: 1, login: "s2", role: "S2" });
const guardaToken = signAccessToken({ id: 2, login: "guarda", role: "Guarda" });

describe("settings routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(() => {
    routeState.destinations.length = 0;
    routeState.nextId = 1;
    routeState.destinations.push(
      { id: 1, name: "S2", isDefault: true },
      { id: 2, name: "PCM", isDefault: true }
    );
  });

  afterAll(async () => {
    await app.close();
  });

  describe("destinations", () => {
    it("lists destinations with S2", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/settings/destinations",
        cookies: { accessToken: s2Token },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().destinations).toEqual(["S2", "PCM"]);
    });

    it("adds a destination with S2 (201)", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/settings/destinations",
        cookies: { accessToken: s2Token },
        payload: { name: "CIA MANUT" },
      });

      expect(response.statusCode).toBe(201);
      expect(response.json().destinations).toEqual(["S2", "PCM", "CIA MANUT"]);
    });

    it("requires authentication to change destinations (401)", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/settings/destinations",
        payload: { name: "NOVA" },
      });

      expect(response.statusCode).toBe(401);
    });

    it.each([
      ["POST", "/settings/destinations"],
      ["DELETE", "/settings/destinations/PCM"],
      ["POST", "/settings/destinations/reset"],
    ] as const)("forbids %s %s for Guarda (403)", async (method, url) => {
      const response = await app.inject({
        method,
        url,
        cookies: { accessToken: guardaToken },
        ...(method === "POST" ? { payload: { name: "NOVA" } } : {}),
      });

      expect(response.statusCode).toBe(403);
    });

    it("rejects an empty destination name (400)", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/settings/destinations",
        cookies: { accessToken: s2Token },
        payload: { name: "   " },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().code).toBe("VALIDATION_ERROR");
    });

    it("rejects a duplicated destination (409)", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/settings/destinations",
        cookies: { accessToken: s2Token },
        payload: { name: "S2" },
      });

      expect(response.statusCode).toBe(409);
      expect(response.json().code).toBe("CONFLICT");
    });

    it("deletes a destination with S2", async () => {
      const response = await app.inject({
        method: "DELETE",
        url: "/settings/destinations/PCM",
        cookies: { accessToken: s2Token },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().destinations).toEqual(["S2"]);
    });

    it("returns 404 when deleting an unknown destination", async () => {
      const response = await app.inject({
        method: "DELETE",
        url: "/settings/destinations/NAO-EXISTE",
        cookies: { accessToken: s2Token },
      });

      expect(response.statusCode).toBe(404);
      expect(response.json().code).toBe("NOT_FOUND");
    });

    it("resets destinations to defaults with S2", async () => {
      routeState.destinations.push({ id: 9, name: "Custom", isDefault: false });

      const response = await app.inject({
        method: "POST",
        url: "/settings/destinations/reset",
        cookies: { accessToken: s2Token },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().destinations).toEqual(["S2", "PCM"]);
    });
  });

  describe("legacy color and system settings endpoints", () => {
    it.each([
      ["GET", "/settings/colors"],
      ["POST", "/settings/colors"],
      ["GET", "/settings/system"],
      ["POST", "/settings/system/reset"],
    ])("%s %s no longer exists (404)", async (method, url) => {
      const response = await app.inject({
        method: method as "GET",
        url,
        cookies: { accessToken: s2Token },
      });

      expect(response.statusCode).toBe(404);
    });
  });
});
