import fs from "fs";
import type { FastifyInstance } from "fastify";
import path from "path";
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
          // Usuário legado com perfil que não existe mais.
          4: { id: 4, login: "antigo", password: "x", role: "Ofdia" },
        };
        return users[id] ?? null;
      },
    },
  };
});

import { encryptBuffer } from "../../helpers/imageEncryption.js";
import { storedImageDir } from "../../helpers/imageServing.js";
import { signAccessToken } from "../../lib/auth.js";
import { createTestApp } from "../helpers/create-test-app.js";

const guardaToken = signAccessToken({ id: 2, login: "guarda", role: "Guarda" });
const legacyToken = signAccessToken({ id: 4, login: "antigo", role: "Ofdia" });
const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 1, 2, 3]);

// Grava uma imagem criptografada real na pasta de uploads durante o teste.
function withStoredImage(subdir: string, run: (filename: string) => Promise<void>) {
  return async () => {
    const dir = storedImageDir(subdir);
    fs.mkdirSync(dir, { recursive: true });
    const filename = `test-${process.pid}-${Date.now()}.jpg.encrypted`;
    const file = path.join(dir, filename);
    fs.writeFileSync(file, encryptBuffer(JPEG_BYTES));
    try {
      await run(filename);
    } finally {
      fs.rmSync(file, { force: true });
    }
  };
}

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

    it(
      "decrypts and serves a stored image (200)",
      withStoredImage("visitors", async (filename) => {
        const response = await app.inject({
          method: "GET",
          url: `/images/visitors/${filename}`,
          cookies: { accessToken: guardaToken },
        });

        expect(response.statusCode).toBe(200);
        expect(response.headers["content-type"]).toMatch(/^image\/jpeg/);
        expect(response.rawPayload.equals(JPEG_BYTES)).toBe(true);
      })
    );

    it("rejects a path traversal filename (400)", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/images/visitors/..%2Fsecret.png",
        cookies: { accessToken: guardaToken },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe("GET /images/pessoas-nao-autorizadas/:filename", () => {
    it(
      "serves the image to Guarda (200)",
      withStoredImage("pessoas-nao-autorizadas", async (filename) => {
        const response = await app.inject({
          method: "GET",
          url: `/images/pessoas-nao-autorizadas/${filename}`,
          cookies: { accessToken: guardaToken },
        });

        expect(response.statusCode).toBe(200);
      })
    );

    it("forbids profiles outside the Guarda roles (403)", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/images/pessoas-nao-autorizadas/qualquer.jpg.encrypted",
        cookies: { accessToken: legacyToken },
      });

      expect(response.statusCode).toBe(403);
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
