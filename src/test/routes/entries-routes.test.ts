import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const routeState = vi.hoisted(() => ({
  entries: new Map<
    number,
    {
      id: number;
      type: string;
      isVisitor: boolean;
      isPermissionario: boolean;
      isScheduled: boolean;
      name: string;
      idNumber: string;
      licensePlate: string;
      carModel: string;
      time: Date;
      target: string | null;
      contactPerson: string | null;
      color: string;
      exited: boolean;
      phoneNumber: string | null;
      imagePath: string | null;
      scheduledDate: Date | null;
    }
  >(),
  nextId: 1,
}));

type EntryRow = NonNullable<ReturnType<typeof routeState.entries.get>>;

function row(
  overrides: Partial<EntryRow> & { name: string }
): EntryRow {
  return {
    id: routeState.nextId++,
    type: "Entrada",
    isVisitor: true,
    isPermissionario: false,
    isScheduled: false,
    name: overrides.name,
    idNumber: overrides.idNumber ?? "",
    licensePlate: overrides.licensePlate ?? "ABC1234",
    carModel: overrides.carModel ?? "Gol",
    time: overrides.time ?? new Date("2026-08-01T10:00:00.000Z"),
    target: overrides.target ?? "CIA MANUT",
    contactPerson: overrides.contactPerson ?? null,
    color: overrides.color ?? "Prata",
    exited: overrides.exited ?? false,
    phoneNumber: overrides.phoneNumber ?? null,
    imagePath: overrides.imagePath ?? null,
    scheduledDate: overrides.scheduledDate ?? null,
    ...overrides,
  } as EntryRow;
}

const openCriteria = (criteria: {
  name: string;
  isVisitor?: boolean;
  isPermissionario?: boolean;
}) =>
  Array.from(routeState.entries.values()).filter(
    (e) =>
      e.type === "Entrada" &&
      e.exited !== true &&
      e.name === criteria.name &&
      (criteria.isVisitor === undefined ||
        e.isVisitor === criteria.isVisitor) &&
      (criteria.isPermissionario === undefined ||
        e.isPermissionario === criteria.isPermissionario)
  );

vi.mock("../../services/image-storage-service.js", () => ({
  fsImageStorage: {
    async saveVisitorImage() {
      return "/uploads/visitors/stubbed.jpg";
    },
  },
}));

vi.mock("../../repositories/entry-repository.js", () => ({
  prismaEntryRepository: {
    async findMany() {
      return Array.from(routeState.entries.values());
    },
    async findById(id: number) {
      return routeState.entries.get(id) ?? null;
    },
    async findByDateRange(initial: Date, final: Date, includeScheduled: boolean) {
      return Array.from(routeState.entries.values()).filter((e) => {
        if (!includeScheduled && e.isScheduled) return false;
        return e.time >= initial && e.time < final;
      });
    },
    async findScheduled() {
      return Array.from(routeState.entries.values()).filter(
        (e) => e.isScheduled && e.type === "Entrada"
      );
    },
    async findLatestVisitorByDocument(documents: string[]) {
      return (
        Array.from(routeState.entries.values())
          .filter((e) => e.isVisitor && e.type === "Entrada" && documents.includes(e.idNumber))
          .sort((a, b) => b.time.getTime() - a.time.getTime())[0] ?? null
      );
    },
    async findOpenEntry(criteria: {
      name: string;
      isVisitor?: boolean;
      isPermissionario?: boolean;
    }) {
      const matches = openCriteria(criteria).sort(
        (a, b) => b.time.getTime() - a.time.getTime()
      );
      return matches[0] ?? null;
    },
    async create(data: Record<string, unknown>) {
      const entry = {
        id: routeState.nextId++,
        type: data.type,
        isVisitor: data.isVisitor,
        isPermissionario: data.isPermissionario ?? false,
        isScheduled: data.isScheduled,
        name: data.name,
        idNumber: data.idNumber ?? "",
        licensePlate: data.licensePlate ?? "",
        carModel: data.carModel ?? "",
        time: data.time,
        target: data.target ?? null,
        contactPerson: data.contactPerson ?? null,
        color: data.color ?? "",
        exited: false,
        phoneNumber: data.phoneNumber ?? null,
        imagePath: data.imagePath ?? null,
        scheduledDate: data.scheduledDate ?? null,
      } as EntryRow;
      routeState.entries.set(entry.id, entry);
      return entry;
    },
    async update(id: number, data: Record<string, unknown>) {
      const entry = routeState.entries.get(id);
      if (!entry) throw { code: "P2025" };
      const updated = { ...entry, ...data } as EntryRow;
      routeState.entries.set(id, updated);
      return updated;
    },
    async remove(id: number) {
      const entry = routeState.entries.get(id);
      if (!entry) throw { code: "P2025" };
      routeState.entries.delete(id);
      return entry;
    },
  },
}));

vi.mock("../../repositories/user-repository.js", () => ({
  prismaUserRepository: {
    async findById(id: number) {
      const users: Record<
        number,
        { id: number; login: string; password: string; role: string }
      > = {
        1: { id: 1, login: "s2", password: "x", role: "S2" },
        2: { id: 2, login: "guarda", password: "x", role: "Guarda" },
        3: { id: 3, login: "sta", password: "x", role: "Sta" },
      };
      return users[id] ?? null;
    },
  },
}));

import { signAccessToken } from "../../lib/auth.js";
import { createTestApp } from "../helpers/create-test-app.js";

// Assinatura mínima de JPEG: o backend confere o conteúdo real da imagem.
const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

const s2Token = signAccessToken({ id: 1, login: "s2", role: "S2" });
const guardaToken = signAccessToken({ id: 2, login: "guarda", role: "Guarda" });
const staToken = signAccessToken({ id: 3, login: "sta", role: "Sta" });

function buildMultipart(
  fields: Record<string, string>,
  file?: { fieldname: string; filename: string; contentType: string; data: Buffer }
) {
  const boundary = "----vitest-boundary-2026";
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

describe("entries routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(() => {
    routeState.entries.clear();
    routeState.nextId = 1;
    routeState.entries.set(
      1,
      row({
        id: 1,
        name: "Maria Souza",
        isVisitor: true,
        time: new Date("2026-08-01T10:00:00.000Z"),
      })
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it("lists entries with authentication", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/entries",
      cookies: { accessToken: guardaToken },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveLength(1);
    expect(response.json()[0]).toMatchObject({ id: 1, name: "Maria Souza" });
  });

  it("rejects listing entries without authentication", async () => {
    const response = await app.inject({ method: "GET", url: "/entries" });
    expect(response.statusCode).toBe(401);
    expect(response.json().code).toBe("UNAUTHORIZED");
  });

  it("returns an entry by id", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/entries/1",
      cookies: { accessToken: guardaToken },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ id: 1, name: "Maria Souza" });
  });

  it("returns 404 when an entry is not found", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/entries/999",
      cookies: { accessToken: guardaToken },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().code).toBe("NOT_FOUND");
  });

  it("queries entries by date range", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/entries/byDate",
      cookies: { accessToken: guardaToken },
      payload: {
        initialDate: "2026-08-01T00:00:00.000Z",
        finalDate: "2026-08-02T00:00:00.000Z",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveLength(1);
  });

  it("rejects a byDate query with an invalid range", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/entries/byDate",
      cookies: { accessToken: guardaToken },
      payload: {
        initialDate: "2026-08-02T00:00:00.000Z",
        finalDate: "2026-08-01T00:00:00.000Z",
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe("VALIDATION_ERROR");
  });

  it("registers a visitor entry via multipart with an image (201)", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/entries",
      cookies: { accessToken: guardaToken },
      ...buildMultipart(
        { name: "Visitante Novo", type: "Entrada", isVisitor: "true", idNumber: "529.982.247-25", onFoot: "true" },
        { fieldname: "image", filename: "photo.jpg", contentType: "image/jpeg", data: JPEG_BYTES }
      ),
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().entry).toMatchObject({
      name: "Visitante Novo",
      imagePath: "/uploads/visitors/stubbed.jpg",
    });
  });

  const visitorImage = {
    fieldname: "image",
    filename: "photo.jpg",
    contentType: "image/jpeg",
    data: JPEG_BYTES,
  };

  it("stores the visitor CPF as digits and normalizes the plate", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/entries",
      cookies: { accessToken: guardaToken },
      ...buildMultipart(
        {
          name: "Visitante Com Carro",
          type: "Entrada",
          isVisitor: "true",
          idNumber: "529.982.247-25",
          licensePlate: "abc-1d23",
          carModel: "Gol",
          color: "Prata",
        },
        visitorImage
      ),
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().entry).toMatchObject({
      idNumber: "52998224725",
      licensePlate: "ABC1D23",
      carModel: "Gol",
      color: "Prata",
    });
  });

  it("rejects a second entry for a visitor already inside (409)", async () => {
    const register = () =>
      app.inject({
        method: "POST",
        url: "/entries",
        cookies: { accessToken: guardaToken },
        ...buildMultipart(
          {
            name: "Visitante Repetido",
            type: "Entrada",
            isVisitor: "true",
            idNumber: "529.982.247-25",
            onFoot: "true",
          },
          visitorImage
        ),
      });

    expect((await register()).statusCode).toBe(201);
    const second = await register();
    expect(second.statusCode).toBe(409);
    expect(second.json().code).toBe("CONFLICT");
  });

  it("clears vehicle fields for a visitor on foot", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/entries",
      cookies: { accessToken: guardaToken },
      ...buildMultipart(
        {
          name: "Visitante A Pe",
          type: "Entrada",
          isVisitor: "true",
          idNumber: "529.982.247-25",
          onFoot: "true",
          licensePlate: "ABC1D23",
          carModel: "Gol",
          color: "Prata",
        },
        visitorImage
      ),
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().entry).toMatchObject({
      licensePlate: "",
      carModel: "",
      color: "",
    });
  });

  it("requires vehicle data for a visitor not on foot (400)", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/entries",
      cookies: { accessToken: guardaToken },
      ...buildMultipart(
        { name: "Sem Carro", type: "Entrada", isVisitor: "true", idNumber: "529.982.247-25" },
        visitorImage
      ),
    });

    expect(response.statusCode).toBe(400);
    const fields = response.json().details.map((d: { field: string }) => d.field);
    expect(fields).toEqual(expect.arrayContaining(["licensePlate", "carModel", "color"]));
  });

  it.each([
    ["letters in CPF", { idNumber: "529.982.247-2A" }],
    ["invalid CPF digits", { idNumber: "111.111.111-11" }],
    ["special characters in name", { name: "Visitante <script>" }],
  ])("rejects a visitor entry with %s (400)", async (_label, override) => {
    const response = await app.inject({
      method: "POST",
      url: "/entries",
      cookies: { accessToken: guardaToken },
      ...buildMultipart(
        {
          name: "Visitante",
          type: "Entrada",
          isVisitor: "true",
          idNumber: "529.982.247-25",
          onFoot: "true",
          ...override,
        },
        visitorImage
      ),
    });

    expect(response.statusCode).toBe(400);
  });

  it("rejects an upload that is not really an image (400)", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/entries",
      cookies: { accessToken: guardaToken },
      ...buildMultipart(
        {
          name: "Visitante",
          type: "Entrada",
          isVisitor: "true",
          idNumber: "529.982.247-25",
          onFoot: "true",
        },
        { ...visitorImage, data: Buffer.from("<html>nao sou imagem</html>") }
      ),
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toMatch(/imagem válida/);
  });

  describe("visitor lookup by CPF", () => {
    it("returns the most recent visit, matching masked legacy CPFs", async () => {
      routeState.entries.set(
        10,
        row({ id: 10, isVisitor: true, name: "Antigo", idNumber: "529.982.247-25", phoneNumber: "(61) 1111-1111", time: new Date("2026-01-01T10:00:00Z") })
      );
      routeState.entries.set(
        11,
        row({ id: 11, isVisitor: true, name: "Recente", idNumber: "52998224725", phoneNumber: "(61) 99999-0000", licensePlate: "ABC1D23", carModel: "Gol", color: "Prata", imagePath: "/uploads/visitors/x.jpg", time: new Date("2026-06-01T10:00:00Z") })
      );

      const response = await app.inject({
        method: "GET",
        url: "/entries/visitor-lookup/529.982.247-25",
        cookies: { accessToken: guardaToken },
      });

      expect(response.statusCode).toBe(200);
      const { visitor } = response.json();
      expect(visitor).toMatchObject({
        name: "Recente",
        phoneNumber: "(61) 99999-0000",
        licensePlate: "ABC1D23",
        carModel: "Gol",
        color: "Prata",
      });
      expect(visitor).not.toHaveProperty("imagePath");
    });

    it("returns null when the CPF never visited", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/entries/visitor-lookup/52998224725",
        cookies: { accessToken: guardaToken },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ visitor: null });
    });

    it("rejects an invalid CPF (400)", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/entries/visitor-lookup/12345678900",
        cookies: { accessToken: guardaToken },
      });

      expect(response.statusCode).toBe(400);
    });

    it("requires authentication (401)", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/entries/visitor-lookup/52998224725",
      });

      expect(response.statusCode).toBe(401);
    });
  });

  it("rejects entry creation without authentication", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/entries",
      ...buildMultipart({ name: "X", type: "Entrada", isVisitor: "true" }),
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().code).toBe("UNAUTHORIZED");
  });

  it("forbids entry creation for a non-operational role", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/entries",
      cookies: { accessToken: staToken },
      ...buildMultipart(
        { name: "Visitante Novo", type: "Entrada", isVisitor: "true", idNumber: "529.982.247-25", onFoot: "true" },
        { fieldname: "image", filename: "photo.jpg", contentType: "image/jpeg", data: JPEG_BYTES }
      ),
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().code).toBe("FORBIDDEN");
  });

  it("creates a scheduled entry with S2 (201)", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/entries/schedule",
      cookies: { accessToken: s2Token },
      payload: {
        name: "Agendado",
        idNumber: "529.982.247-25",
        onFoot: true,
        scheduledDate: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().agendamento).toMatchObject({
      name: "Agendado",
      isScheduled: true,
    });
  });

  it("forbids creating a scheduled entry for a non-S2 role", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/entries/schedule",
      cookies: { accessToken: guardaToken },
      payload: {
        name: "Agendado",
        idNumber: "529.982.247-25",
        onFoot: true,
        scheduledDate: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().code).toBe("FORBIDDEN");
  });

  it("rejects a scheduled entry with a past date (400)", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/entries/schedule",
      cookies: { accessToken: s2Token },
      payload: {
        name: "Agendado",
        idNumber: "529.982.247-25",
        onFoot: true,
        scheduledDate: new Date(Date.now() - 5000).toISOString(),
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe("BAD_REQUEST");
  });

  it("lists scheduled entries", async () => {
    routeState.entries.set(
      2,
      row({ id: 2, name: "Agendado", isScheduled: true, isVisitor: true })
    );
    const response = await app.inject({
      method: "GET",
      url: "/entries/scheduled",
      cookies: { accessToken: guardaToken },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveLength(1);
    expect(response.json()[0]).toMatchObject({ name: "Agendado" });
  });

  it("registers an exit and marks the original entry (201)", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/exits",
      cookies: { accessToken: guardaToken },
      payload: {
        entryId: 1,
        name: "Maria Souza",
        isVisitor: true,
        isPermissionario: false,
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().exit.type).toBe("Saída");
    expect(response.json().originalEntryUpdated).toBe(true);
    expect(routeState.entries.get(1)?.exited).toBe(true);
  });

  it("returns 404 when creating an exit for a nonexistent entry", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/exits",
      cookies: { accessToken: guardaToken },
      payload: { entryId: 999, name: "Maria" },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().code).toBe("NOT_FOUND");
  });

  it("rejects an exit when the entry was already marked as exited", async () => {
    routeState.entries.set(1, row({ id: 1, name: "Maria Souza", exited: true }));
    const response = await app.inject({
      method: "POST",
      url: "/exits",
      cookies: { accessToken: guardaToken },
      payload: { entryId: 1, name: "Maria Souza" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe("BAD_REQUEST");
  });

  it("confirms a scheduled entry with an image as Guarda (200)", async () => {
    routeState.entries.set(
      2,
      row({ id: 2, name: "Agendado", isScheduled: true, isVisitor: true })
    );
    const response = await app.inject({
      method: "PATCH",
      url: "/entries/scheduled/2/confirm",
      cookies: { accessToken: guardaToken },
      ...buildMultipart({}, {
        fieldname: "image", filename: "photo.jpg", contentType: "image/jpeg", data: JPEG_BYTES,
      }),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().entry).toMatchObject({
      isScheduled: false,
      imagePath: "/uploads/visitors/stubbed.jpg",
    });
  });

  it("forbids confirming a scheduled entry for a non-Guarda role", async () => {
    routeState.entries.set(
      2,
      row({ id: 2, name: "Agendado", isScheduled: true, isVisitor: true })
    );
    const response = await app.inject({
      method: "PATCH",
      url: "/entries/scheduled/2/confirm",
      cookies: { accessToken: s2Token },
      ...buildMultipart({}, {
        fieldname: "image", filename: "photo.jpg", contentType: "image/jpeg", data: JPEG_BYTES,
      }),
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().code).toBe("FORBIDDEN");
  });
  describe("scheduled entry management (S2)", () => {
    const future = () => new Date(Date.now() + 48 * 3600 * 1000).toISOString();
    const payload = (overrides: Record<string, unknown> = {}) => ({
      name: "Agendado Editado",
      idNumber: "529.982.247-25",
      onFoot: true,
      target: "SFPC",
      scheduledDate: future(),
      ...overrides,
    });

    function seedPending(id = 20) {
      routeState.entries.set(
        id,
        row({
          id,
          name: "Agendado",
          isScheduled: true,
          scheduledDate: new Date(Date.now() + 24 * 3600 * 1000),
        })
      );
    }

    it("updates a pending scheduled entry", async () => {
      seedPending();
      const response = await app.inject({
        method: "PUT",
        url: "/entries/scheduled/20",
        cookies: { accessToken: s2Token },
        payload: payload(),
      });

      expect(response.statusCode).toBe(200);
      expect(routeState.entries.get(20)).toMatchObject({
        name: "Agendado Editado",
        idNumber: "52998224725",
        licensePlate: "",
        target: "SFPC",
        isScheduled: true,
      });
    });

    it("rejects moving a scheduled entry to the past (400)", async () => {
      seedPending();
      const response = await app.inject({
        method: "PUT",
        url: "/entries/scheduled/20",
        cookies: { accessToken: s2Token },
        payload: payload({ scheduledDate: new Date(Date.now() - 60000).toISOString() }),
      });

      expect(response.statusCode).toBe(400);
    });

    it("does not edit a schedule already confirmed by the Guarda (409)", async () => {
      routeState.entries.set(
        21,
        row({ id: 21, name: "Ja entrou", isScheduled: false, scheduledDate: new Date() })
      );
      const response = await app.inject({
        method: "PUT",
        url: "/entries/scheduled/21",
        cookies: { accessToken: s2Token },
        payload: payload(),
      });

      expect(response.statusCode).toBe(409);
    });

    it("returns 404 for a regular entry or unknown id", async () => {
      routeState.entries.set(22, row({ id: 22, name: "Entrada comum" }));
      for (const id of [22, 999]) {
        const response = await app.inject({
          method: "DELETE",
          url: `/entries/scheduled/${id}`,
          cookies: { accessToken: s2Token },
        });
        expect(response.statusCode).toBe(404);
      }
      expect(routeState.entries.has(22)).toBe(true);
    });

    it("deletes a pending scheduled entry", async () => {
      seedPending();
      const response = await app.inject({
        method: "DELETE",
        url: "/entries/scheduled/20",
        cookies: { accessToken: s2Token },
      });

      expect(response.statusCode).toBe(200);
      expect(routeState.entries.has(20)).toBe(false);
    });

    it("forbids editing or deleting for the Guarda", async () => {
      seedPending();
      const put = await app.inject({
        method: "PUT",
        url: "/entries/scheduled/20",
        cookies: { accessToken: guardaToken },
        payload: payload(),
      });
      const del = await app.inject({
        method: "DELETE",
        url: "/entries/scheduled/20",
        cookies: { accessToken: guardaToken },
      });

      expect(put.statusCode).toBe(403);
      expect(del.statusCode).toBe(403);
      expect(routeState.entries.get(20)?.name).toBe("Agendado");
    });

    it("requires S2 for the scheduled date-range report", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/entries/scheduled/byDate",
        cookies: { accessToken: guardaToken },
        payload: {
          initialDate: "2026-11-01T00:00:00.000Z",
          finalDate: "2026-12-01T00:00:00.000Z",
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it("accepts a local-day range on the scheduled list", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/entries/scheduled?from=2026-11-26T03:00:00.000Z&to=2026-11-27T03:00:00.000Z",
        cookies: { accessToken: guardaToken },
      });
      expect(response.statusCode).toBe(200);

      const invalid = await app.inject({
        method: "GET",
        url: "/entries/scheduled?from=2026-11-27T03:00:00.000Z&to=2026-11-26T03:00:00.000Z",
        cookies: { accessToken: guardaToken },
      });
      expect(invalid.statusCode).toBe(400);
    });
  });
});
