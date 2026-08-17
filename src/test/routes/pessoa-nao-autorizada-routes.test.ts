import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const routeState = vi.hoisted(() => ({
  pessoas: new Map<
    number,
    {
      id: number;
      nome: string;
      CPF: string;
      identidade: string | null;
      observacao: string | null;
      imagePath: string | null;
    }
  >(),
  nextId: 1,
  deletedImages: [] as string[],
}));

type PessoaRow = NonNullable<ReturnType<typeof routeState.pessoas.get>>;

vi.mock("../../repositories/pessoa-nao-autorizada-repository.js", () => {
  return {
    prismaPessoaNaoAutorizadaRepository: {
      async findMany() {
        return Array.from(routeState.pessoas.values());
      },
      async findById(id: number) {
        return routeState.pessoas.get(id) ?? null;
      },
      async findByCpf(cpf: string) {
        return (
          Array.from(routeState.pessoas.values()).find(
            (p) => p.CPF === cpf
          ) ?? null
        );
      },
      async create(data: Record<string, unknown>) {
        const pessoa = {
          id: routeState.nextId++,
          ...data,
        } as unknown as PessoaRow;
        routeState.pessoas.set(pessoa.id, pessoa);
        return pessoa;
      },
      async update(id: number, data: Record<string, unknown>) {
        const pessoa = routeState.pessoas.get(id);
        if (!pessoa) throw { code: "P2025" };
        const updated = { ...pessoa, ...data } as PessoaRow;
        routeState.pessoas.set(id, updated);
        return updated;
      },
      async remove(id: number) {
        const pessoa = routeState.pessoas.get(id);
        if (!pessoa) throw { code: "P2025" };
        routeState.pessoas.delete(id);
        return pessoa;
      },
    },
  };
});

vi.mock("../../services/image-storage-service.js", () => {
  return {
    fsImageStorage: {
      async saveUnauthorizedPersonImage() {
        return "/uploads/pessoas-nao-autorizadas/stubbed.jpg.encrypted";
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
  const boundary = "----vitest-boundary-pessoa";
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
  nome: "Pessoa Impedida",
  CPF: "52998224725",
  identidade: "123456789",
  observacao: "Motivo da restrição",
};

const validCpf = "52998224725";

describe("pessoas-nao-autorizadas routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(() => {
    routeState.pessoas.clear();
    routeState.deletedImages.length = 0;
    routeState.nextId = 1;
    routeState.pessoas.set(1, {
      id: 1,
      nome: "Maria Impedida",
      CPF: "11144477735",
      identidade: "0987654321",
      observacao: "Registro existente",
      imagePath: null,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("lists pessoas with Guarda role", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/pessoas-nao-autorizadas",
      cookies: { accessToken: guardaToken },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveLength(1);
    expect(response.json()[0]).toMatchObject({ id: 1, nome: "Maria Impedida" });
  });

  it("rejects listing pessoas without authentication", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/pessoas-nao-autorizadas",
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().code).toBe("UNAUTHORIZED");
  });

  it("returns a pessoa by id with Guarda role", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/pessoas-nao-autorizadas/1",
      cookies: { accessToken: guardaToken },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ id: 1, CPF: "11144477735" });
  });

  it("returns 404 when a pessoa by id is not found", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/pessoas-nao-autorizadas/999",
      cookies: { accessToken: guardaToken },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().code).toBe("NOT_FOUND");
  });

  it("rejects create without authentication", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/pessoas-nao-autorizadas",
      ...buildMultipart(validBody),
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().code).toBe("UNAUTHORIZED");
  });

  it("rejects create for a Guarda profile (403)", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/pessoas-nao-autorizadas",
      cookies: { accessToken: guardaToken },
      ...buildMultipart(validBody),
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().code).toBe("FORBIDDEN");
  });

  it("creates a pessoa with S2 and returns 201", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/pessoas-nao-autorizadas",
      cookies: { accessToken: s2Token },
      ...buildMultipart(
        validBody,
        { fieldname: "image", filename: "photo.jpg", contentType: "image/jpeg", data: Buffer.from("fake-image") }
      ),
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().pessoa).toMatchObject({
      nome: "Pessoa Impedida",
      CPF: validCpf,
      imagePath: "/uploads/pessoas-nao-autorizadas/stubbed.jpg.encrypted",
    });
  });

  it("normalizes a masked CPF on create", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/pessoas-nao-autorizadas",
      cookies: { accessToken: s2Token },
      ...buildMultipart({ ...validBody, CPF: "529.982.247-25" }),
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().pessoa.CPF).toBe(validCpf);
  });

  it("rejects create with a duplicated CPF (409)", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/pessoas-nao-autorizadas",
      cookies: { accessToken: s2Token },
      ...buildMultipart({ ...validBody, CPF: "111.444.777-35" }),
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().code).toBe("CONFLICT");
    expect(routeState.pessoas.size).toBe(1);
  });

  it("rejects create with an invalid body (400)", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/pessoas-nao-autorizadas",
      cookies: { accessToken: s2Token },
      ...buildMultipart({ nome: "" }),
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe("VALIDATION_ERROR");
  });

  it("rejects create with an invalid CPF (400)", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/pessoas-nao-autorizadas",
      cookies: { accessToken: s2Token },
      ...buildMultipart({ ...validBody, CPF: "123.456.789-00" }),
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe("VALIDATION_ERROR");
  });

  it("updates a pessoa with S2 (200)", async () => {
    const response = await app.inject({
      method: "PATCH",
      url: "/pessoas-nao-autorizadas/1",
      cookies: { accessToken: s2Token },
      ...buildMultipart({ observacao: "Nova observação" }),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().pessoa).toMatchObject({
      id: 1,
      observacao: "Nova observação",
    });
  });

  it("replaces the image on update when a new file is sent", async () => {
    routeState.pessoas.set(1, {
      id: 1,
      nome: "Maria Impedida",
      CPF: "11144477735",
      identidade: "0987654321",
      observacao: "Registro existente",
      imagePath: "/uploads/pessoas-nao-autorizadas/old.jpg.encrypted",
    });

    const response = await app.inject({
      method: "PATCH",
      url: "/pessoas-nao-autorizadas/1",
      cookies: { accessToken: s2Token },
      ...buildMultipart(
        { observacao: "Atualizada" },
        { fieldname: "image", filename: "new.jpg", contentType: "image/jpeg", data: Buffer.from("new") }
      ),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().pessoa.imagePath).toBe(
      "/uploads/pessoas-nao-autorizadas/stubbed.jpg.encrypted"
    );
    expect(routeState.deletedImages).toEqual([
      "/uploads/pessoas-nao-autorizadas/old.jpg.encrypted",
    ]);
  });

  it("keeps the existing image when no new file is sent", async () => {
    routeState.pessoas.set(1, {
      id: 1,
      nome: "Maria Impedida",
      CPF: "11144477735",
      identidade: "0987654321",
      observacao: "Registro existente",
      imagePath: "/uploads/pessoas-nao-autorizadas/keep.jpg.encrypted",
    });

    const response = await app.inject({
      method: "PATCH",
      url: "/pessoas-nao-autorizadas/1",
      cookies: { accessToken: s2Token },
      ...buildMultipart({ observacao: "Mantendo foto" }),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().pessoa.imagePath).toBe(
      "/uploads/pessoas-nao-autorizadas/keep.jpg.encrypted"
    );
    expect(routeState.deletedImages).toEqual([]);
  });

  it("returns 404 when updating a nonexistent pessoa", async () => {
    const response = await app.inject({
      method: "PATCH",
      url: "/pessoas-nao-autorizadas/999",
      cookies: { accessToken: s2Token },
      ...buildMultipart({ observacao: "X" }),
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().code).toBe("NOT_FOUND");
  });

  it("deletes a pessoa with S2 (200)", async () => {
    const response = await app.inject({
      method: "DELETE",
      url: "/pessoas-nao-autorizadas/1",
      cookies: { accessToken: s2Token },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().id).toBe(1);
    expect(routeState.pessoas.size).toBe(0);
  });

  it("removes the stored image when deleting a pessoa", async () => {
    routeState.pessoas.set(1, {
      id: 1,
      nome: "Maria Impedida",
      CPF: "11144477735",
      identidade: "0987654321",
      observacao: "Registro existente",
      imagePath: "/uploads/pessoas-nao-autorizadas/old.jpg.encrypted",
    });

    const response = await app.inject({
      method: "DELETE",
      url: "/pessoas-nao-autorizadas/1",
      cookies: { accessToken: s2Token },
    });

    expect(response.statusCode).toBe(200);
    expect(routeState.deletedImages).toEqual([
      "/uploads/pessoas-nao-autorizadas/old.jpg.encrypted",
    ]);
  });

  it("serves a pessoa image via the images route", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/images/pessoas-nao-autorizadas/some-file.jpg.encrypted",
      cookies: { accessToken: guardaToken },
    });

    expect([200, 404]).toContain(response.statusCode);
  });
});
