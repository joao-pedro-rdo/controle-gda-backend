import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const routeState = vi.hoisted(() => ({
  permissionarios: new Map<
    number,
    {
      id: number;
      completeName: string;
      idNumber: string;
      CPF: string;
      local: string | null;
      carModel: string | null;
      licensePlate: string | null;
      color: string | null;
      imagePath: string | null;
    }
  >(),
  nextId: 1,
  deletedImages: [] as string[],
}));

type PermissionarioRow = NonNullable<
  ReturnType<typeof routeState.permissionarios.get>
>;

vi.mock("../../repositories/permissionario-repository.js", () => {
  return {
    prismaPermissionarioRepository: {
      async findMany() {
        return Array.from(routeState.permissionarios.values());
      },
      async findById(id: number) {
        return routeState.permissionarios.get(id) ?? null;
      },
      async findByCpf(cpf: string) {
        return (
          Array.from(routeState.permissionarios.values()).find(
            (p) => p.CPF === cpf
          ) ?? null
        );
      },
      async create(data: Record<string, unknown>) {
        const permissionario = {
          id: routeState.nextId++,
          ...data,
        } as unknown as PermissionarioRow;
        routeState.permissionarios.set(permissionario.id, permissionario);
        return permissionario;
      },
      async update(id: number, data: Record<string, unknown>) {
        const permissionario = routeState.permissionarios.get(id);
        if (!permissionario) throw { code: "P2025" };
        const updated = { ...permissionario, ...data } as PermissionarioRow;
        routeState.permissionarios.set(id, updated);
        return updated;
      },
      async remove(id: number) {
        const permissionario = routeState.permissionarios.get(id);
        if (!permissionario) throw { code: "P2025" };
        routeState.permissionarios.delete(id);
        return permissionario;
      },
    },
  };
});

vi.mock("../../services/image-storage-service.js", () => {
  return {
    fsImageStorage: {
      async savePermissionarioImage() {
        return "/uploads/permissionarios/stubbed.jpg.encrypted";
      },
      async deleteImage(imagePath: string | null) {
        if (imagePath) routeState.deletedImages.push(imagePath);
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

function buildMultipart(
  fields: Record<string, string>,
  file?: { fieldname: string; filename: string; contentType: string; data: Buffer }
) {
  const boundary = "----vitest-boundary-permissionario";
  let head = "";
  for (const [key, value] of Object.entries(fields)) {
    head += `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`;
  }
  if (file) {
    head += `--${boundary}\r\nContent-Disposition: form-data; name="${file.fieldname}"; filename="${file.filename}"\r\nContent-Type: ${file.contentType}\r\n\r\n`;
  }
  const tail = `\r\n--${boundary}--\r\n`;
  return {
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
    payload: Buffer.concat([
      Buffer.from(head, "utf8"),
      file ? file.data : Buffer.alloc(0),
      Buffer.from(tail, "utf8"),
    ]) as never,
  };
}

const validBody = {
  completeName: "João da Silva",
  idNumber: "1234567890",
  CPF: "52998224725",
  local: "CIA MANUT",
  carModel: "Gol",
  licensePlate: "ABC1D23",
  color: "Prata",
};

const validCpf = "52998224725";

describe("permissionario routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(() => {
    routeState.permissionarios.clear();
    routeState.deletedImages.length = 0;
    routeState.nextId = 1;
    routeState.permissionarios.set(1, {
      id: 1,
      completeName: "Maria Souza",
      idNumber: "0987654321",
      CPF: "11144477735",
      local: "2º Esqd",
      carModel: "Onix",
      licensePlate: "XYZ2B34",
      color: "Preto",
      imagePath: null,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("lists permissionarios with authentication", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/permissionarios",
      cookies: { accessToken: guardaToken },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveLength(1);
    expect(response.json()[0]).toMatchObject({ id: 1, completeName: "Maria Souza" });
  });

  it("rejects listing permissionarios without authentication", async () => {
    const response = await app.inject({ method: "GET", url: "/permissionarios" });

    expect(response.statusCode).toBe(401);
    expect(response.json().code).toBe("UNAUTHORIZED");
  });

  it("returns a permissionario by id with S2", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/permissionarios/1",
      cookies: { accessToken: s2Token },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ id: 1, CPF: "11144477735" });
  });

  it("forbids fetching permissionario by id for a Guarda", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/permissionarios/1",
      cookies: { accessToken: guardaToken },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().code).toBe("FORBIDDEN");
  });

  it("returns 404 when a permissionario by id is not found", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/permissionarios/999",
      cookies: { accessToken: s2Token },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().code).toBe("NOT_FOUND");
  });

  it("looks up a permissionario by CPF (public QR route)", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/permissionarioByCPF/111.444.777-35",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ id: 1, CPF: "11144477735" });
  });

  it("returns 404 when CPF lookup finds nothing", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/permissionarioByCPF/12345678901",
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().code).toBe("NOT_FOUND");
  });

  it("rejects create without authentication", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/permissionarios",
      ...buildMultipart(validBody),
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().code).toBe("UNAUTHORIZED");
  });

  it("rejects create for a non-S2 profile", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/permissionarios",
      cookies: { accessToken: guardaToken },
      ...buildMultipart(validBody),
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().code).toBe("FORBIDDEN");
  });

  it("creates a permissionario with S2 and returns 201", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/permissionarios",
      cookies: { accessToken: s2Token },
      ...buildMultipart(
        validBody,
        { fieldname: "image", filename: "photo.jpg", contentType: "image/jpeg", data: Buffer.from("fake-image") }
      ),
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      completeName: "João da Silva",
      CPF: validCpf,
      licensePlate: "ABC1D23",
      imagePath: "/uploads/permissionarios/stubbed.jpg.encrypted",
    });
  });

  it("normalizes a masked CPF and plate on create", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/permissionarios",
      cookies: { accessToken: s2Token },
      ...buildMultipart({ ...validBody, CPF: "529.982.247-25", licensePlate: "abc-1d23" }),
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().CPF).toBe(validCpf);
    expect(response.json().licensePlate).toBe("ABC1D23");
  });

  it("rejects create with a duplicated CPF (409)", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/permissionarios",
      cookies: { accessToken: s2Token },
      ...buildMultipart({ ...validBody, CPF: "111.444.777-35" }),
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().code).toBe("CONFLICT");
    expect(routeState.permissionarios.size).toBe(1);
  });

  it("rejects create with an invalid body (400)", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/permissionarios",
      cookies: { accessToken: s2Token },
      ...buildMultipart({ completeName: "X" }),
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe("VALIDATION_ERROR");
  });

  it("rejects create with an invalid CPF (400)", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/permissionarios",
      cookies: { accessToken: s2Token },
      ...buildMultipart({ ...validBody, CPF: "123.456.789-00" }),
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe("VALIDATION_ERROR");
  });

  it("updates a permissionario with S2 (200)", async () => {
    const response = await app.inject({
      method: "PATCH",
      url: "/permissionarios/1",
      cookies: { accessToken: s2Token },
      ...buildMultipart({ color: "Azul" }),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ id: 1, color: "Azul" });
  });

  it("replaces the image on update when a new file is sent", async () => {
    routeState.permissionarios.set(1, {
      id: 1,
      completeName: "Maria Souza",
      idNumber: "0987654321",
      CPF: "11144477735",
      local: "2º Esqd",
      carModel: "Onix",
      licensePlate: "XYZ2B34",
      color: "Preto",
      imagePath: "/uploads/permissionarios/old.jpg.encrypted",
    });

    const response = await app.inject({
      method: "PATCH",
      url: "/permissionarios/1",
      cookies: { accessToken: s2Token },
      ...buildMultipart(
        { color: "Azul" },
        { fieldname: "image", filename: "new.jpg", contentType: "image/jpeg", data: Buffer.from("new") }
      ),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().imagePath).toBe("/uploads/permissionarios/stubbed.jpg.encrypted");
    expect(routeState.deletedImages).toEqual(["/uploads/permissionarios/old.jpg.encrypted"]);
  });

  it("removes the image when removeImage is true", async () => {
    routeState.permissionarios.set(1, {
      id: 1,
      completeName: "Maria Souza",
      idNumber: "0987654321",
      CPF: "11144477735",
      local: "2º Esqd",
      carModel: "Onix",
      licensePlate: "XYZ2B34",
      color: "Preto",
      imagePath: "/uploads/permissionarios/old.jpg.encrypted",
    });

    const response = await app.inject({
      method: "PATCH",
      url: "/permissionarios/1",
      cookies: { accessToken: s2Token },
      ...buildMultipart({ color: "Azul", removeImage: "true" }),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().imagePath).toBeNull();
    expect(routeState.deletedImages).toEqual(["/uploads/permissionarios/old.jpg.encrypted"]);
  });

  it("keeps the existing image when keepExistingImage is true", async () => {
    routeState.permissionarios.set(1, {
      id: 1,
      completeName: "Maria Souza",
      idNumber: "0987654321",
      CPF: "11144477735",
      local: "2º Esqd",
      carModel: "Onix",
      licensePlate: "XYZ2B34",
      color: "Preto",
      imagePath: "/uploads/permissionarios/keep.jpg.encrypted",
    });

    const response = await app.inject({
      method: "PATCH",
      url: "/permissionarios/1",
      cookies: { accessToken: s2Token },
      ...buildMultipart({ color: "Azul", keepExistingImage: "true" }),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().imagePath).toBe("/uploads/permissionarios/keep.jpg.encrypted");
    expect(routeState.deletedImages).toEqual([]);
  });

  it("returns 404 when updating a nonexistent permissionario", async () => {
    const response = await app.inject({
      method: "PATCH",
      url: "/permissionarios/999",
      cookies: { accessToken: s2Token },
      ...buildMultipart({ color: "Azul" }),
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().code).toBe("NOT_FOUND");
  });

  it("rejects an empty update body (400)", async () => {
    const response = await app.inject({
      method: "PATCH",
      url: "/permissionarios/1",
      cookies: { accessToken: s2Token },
      ...buildMultipart({}),
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe("VALIDATION_ERROR");
  });

  it("deletes a permissionario with S2 (200)", async () => {
    const response = await app.inject({
      method: "DELETE",
      url: "/permissionarios/1",
      cookies: { accessToken: s2Token },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ id: 1 });
    expect(routeState.permissionarios.size).toBe(0);
  });

  it("removes the stored image when deleting a permissionario", async () => {
    routeState.permissionarios.set(1, {
      id: 1,
      completeName: "Maria Souza",
      idNumber: "0987654321",
      CPF: "11144477735",
      local: "2º Esqd",
      carModel: "Onix",
      licensePlate: "XYZ2B34",
      color: "Preto",
      imagePath: "/uploads/permissionarios/old.jpg.encrypted",
    });

    const response = await app.inject({
      method: "DELETE",
      url: "/permissionarios/1",
      cookies: { accessToken: s2Token },
    });

    expect(response.statusCode).toBe(200);
    expect(routeState.deletedImages).toEqual(["/uploads/permissionarios/old.jpg.encrypted"]);
  });
});
