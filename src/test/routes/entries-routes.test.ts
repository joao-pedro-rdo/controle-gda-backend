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
        { name: "Visitante Novo", type: "Entrada", isVisitor: "true" },
        { fieldname: "image", filename: "photo.jpg", contentType: "image/jpeg", data: Buffer.from("fake-image") }
      ),
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().entry).toMatchObject({
      name: "Visitante Novo",
      imagePath: "/uploads/visitors/stubbed.jpg",
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
        { name: "Visitante Novo", type: "Entrada", isVisitor: "true" },
        { fieldname: "image", filename: "photo.jpg", contentType: "image/jpeg", data: Buffer.from("fake-image") }
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
        idNumber: "123456",
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
        idNumber: "123456",
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
        idNumber: "123456",
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
        fieldname: "image", filename: "photo.jpg", contentType: "image/jpeg", data: Buffer.from("fake-image"),
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
        fieldname: "image", filename: "photo.jpg", contentType: "image/jpeg", data: Buffer.from("fake-image"),
      }),
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().code).toBe("FORBIDDEN");
  });
});
