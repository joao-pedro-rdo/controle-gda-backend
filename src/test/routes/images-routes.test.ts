import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

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

const guardaToken = signAccessToken({ id: 2, login: "guarda", role: "Guarda" });

describe("images routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  describe("GET /images/visitors/:filename", () => {
    it("requires authentication", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/images/visitors/photo.jpg.encrypted",
      });

      expect(response.statusCode).toBe(401);
    });

    it("returns 404 when the file does not exist on disk", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/images/visitors/photo.jpg.encrypted",
        cookies: { accessToken: guardaToken },
      });

      expect(response.statusCode).toBe(404);
      expect(response.json().code).toBe("NOT_FOUND");
    });

    it("rejects a path traversal filename (400)", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/images/visitors/..%2Fsecret.png",
        cookies: { accessToken: guardaToken },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  // Identidade visual agora vem do deploy (pasta branding + .env no frontend).
  describe("legacy system image endpoints", () => {
    it.each([
      ["GET", "/system-images/current"],
      ["POST", "/system-images/upload/logo"],
      ["DELETE", "/system-images/logo"],
    ])("%s %s no longer exists (404)", async (method, url) => {
      const response = await app.inject({
        method: method as "GET",
        url,
        cookies: { accessToken: guardaToken },
      });

      expect(response.statusCode).toBe(404);
    });
  });
});
