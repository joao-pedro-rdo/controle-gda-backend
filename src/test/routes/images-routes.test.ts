import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const routeState = vi.hoisted(() => ({
  files: [] as string[],
  buffers: new Map<string, Buffer>(),
  removedByPrefixes: [] as string[],
  reads: [] as string[],
}));

vi.mock("../../services/system-image-service.js", () => {
  return {
    systemImageService: {
      async upload(type: "logo" | "background", buffer: Buffer, extension: string) {
        const prefix = type === "background" ? "bg-cover" : "logo";
        const filename = `${prefix}${extension}`;
        routeState.removedByPrefixes.push(prefix);
        routeState.files = routeState.files.filter((f) => !f.startsWith(prefix));
        routeState.files.push(filename);
        routeState.buffers.set(filename, buffer);
        return { url: `/system-images/${filename}`, filename };
      },
      async getCurrent() {
        const logo = routeState.files.find((f) => f.startsWith("logo")) ?? null;
        const background =
          routeState.files.find((f) => f.startsWith("bg-cover")) ?? null;
        return {
          logo: logo ? `/system-images/${logo}` : null,
          background: background ? `/system-images/${background}` : null,
        };
      },
      async reset(type: "logo" | "background") {
        const prefix = type === "background" ? "bg-cover" : "logo";
        const removed = routeState.files.filter((f) => f.startsWith(prefix));
        routeState.removedByPrefixes.push(prefix);
        routeState.files = routeState.files.filter(
          (f) => !f.startsWith(prefix)
        );
        for (const name of removed) routeState.buffers.delete(name);
        return removed.length;
      },
      async read(filename: string) {
        routeState.reads.push(filename);
        if (filename.includes("..")) return null;
        return routeState.buffers.get(filename) ?? null;
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

function buildImageMultipart(
  filename: string,
  contentType: string,
  data = Buffer.from("fake-image-data")
) {
  const boundary = "----vitest-boundary-images";
  const head = `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`;
  const tail = `\r\n--${boundary}--\r\n`;
  return {
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
    payload: Buffer.concat([
      Buffer.from(head, "utf8"),
      data,
      Buffer.from(tail, "utf8"),
    ]) as never,
  };
}

async function uploadLogo(app: FastifyInstance, overrides: Record<string, unknown> = {}) {
  return app.inject({
    method: "POST",
    url: "/system-images/upload/logo",
    cookies: { accessToken: s2Token },
    ...buildImageMultipart("logo.jpg", "image/jpeg"),
    ...overrides,
  });
}

describe("images routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(() => {
    routeState.files.length = 0;
    routeState.buffers.clear();
    routeState.removedByPrefixes.length = 0;
    routeState.reads.length = 0;
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

  describe("GET /system-images/current", () => {
    it("requires authentication", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/system-images/current",
      });

      expect(response.statusCode).toBe(401);
    });

    it("returns nulls (default images) when no custom image exists", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/system-images/current",
        cookies: { accessToken: s2Token },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ logo: null, background: null });
    });

    it("returns custom paths when custom images exist", async () => {
      routeState.files.push("logo.png", "bg-cover.jpg");

      const response = await app.inject({
        method: "GET",
        url: "/system-images/current",
        cookies: { accessToken: s2Token },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        logo: "/system-images/logo.png",
        background: "/system-images/bg-cover.jpg",
      });
    });
  });

  describe("POST /system-images/upload/logo", () => {
    it("uploads a logo with S2", async () => {
      const response = await uploadLogo(app);

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        success: true,
        fileName: "logo.jpg",
        imagePath: "/system-images/logo.jpg",
      });
    });

    it("rejects upload without authentication", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/system-images/upload/logo",
        ...buildImageMultipart("logo.jpg", "image/jpeg"),
      });

      expect(response.statusCode).toBe(401);
      expect(response.json().code).toBe("UNAUTHORIZED");
    });

    it("rejects upload for a Guarda", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/system-images/upload/logo",
        cookies: { accessToken: guardaToken },
        ...buildImageMultipart("logo.jpg", "image/jpeg"),
      });

      expect(response.statusCode).toBe(403);
      expect(response.json().code).toBe("FORBIDDEN");
    });

    it("rejects a non-image payload (400)", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/system-images/upload/logo",
        cookies: { accessToken: s2Token },
        ...buildImageMultipart("nota.pdf", "application/pdf"),
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().code).toBe("BAD_REQUEST");
    });

    it("rejects a disallowed extension (400)", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/system-images/upload/logo",
        cookies: { accessToken: s2Token },
        ...buildImageMultipart("logo.exe", "image/jpeg"),
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().code).toBe("BAD_REQUEST");
    });
  });

  describe("POST /system-images/upload/background", () => {
    it("uploads a background with S2", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/system-images/upload/background",
        cookies: { accessToken: s2Token },
        ...buildImageMultipart("fundo.jpg", "image/jpeg"),
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        success: true,
        fileName: "bg-cover.jpg",
        imagePath: "/system-images/bg-cover.jpg",
      });
    });
  });

  describe("DELETE /system-images/:type", () => {
    it("resets the logo with S2", async () => {
      routeState.files.push("logo.png");

      const response = await app.inject({
        method: "DELETE",
        url: "/system-images/logo",
        cookies: { accessToken: s2Token },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        success: true,
        filesDeleted: 1,
      });
    });

    it("rejects an invalid type (400)", async () => {
      const response = await app.inject({
        method: "DELETE",
        url: "/system-images/favicon",
        cookies: { accessToken: s2Token },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().code).toBe("VALIDATION_ERROR");
    });

    it("rejects reset without authentication", async () => {
      const response = await app.inject({
        method: "DELETE",
        url: "/system-images/logo",
      });

      expect(response.statusCode).toBe(401);
      expect(response.json().code).toBe("UNAUTHORIZED");
    });
  });

  describe("GET /system-images/:filename (public)", () => {
    it("serves an existing system image with the right content type", async () => {
      routeState.buffers.set("logo.png", Buffer.from([0x89, 0x50, 0x4e, 0x47]));

      const response = await app.inject({ method: "GET", url: "/system-images/logo.png" });

      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toBe("image/png");
    });

    it("returns 404 when the image does not exist", async () => {
      const response = await app.inject({ method: "GET", url: "/system-images/logo.png" });

      expect(response.statusCode).toBe(404);
      expect(response.json().code).toBe("NOT_FOUND");
    });

    it("never serves a path traversal filename", async () => {
      const encoded = await app.inject({
        method: "GET",
        url: "/system-images/..%2F.env",
      });
      const literal = await app.inject({
        method: "GET",
        url: "/system-images/..secret.png",
      });

      expect(encoded.statusCode).toBeGreaterThanOrEqual(400);
      expect(literal.statusCode).toBeGreaterThanOrEqual(400);
      expect(routeState.reads).toEqual([]);
    });
  });
});