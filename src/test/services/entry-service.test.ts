import { describe, expect, it, vi } from "vitest";
import type { Entry } from "@prisma/client";

import { createEntryService } from "../../services/entry-service.js";
import type { EntryRepository } from "../../repositories/entry-repository.js";
import type { CreateEntryParsed } from "../../schemas/entries-schema.js";

let nextId = 1;
const entries = new Map<number, Entry>();

const repository: EntryRepository = {
  async findMany() {
    return Array.from(entries.values());
  },
  async findById(id) {
    return entries.get(id) ?? null;
  },
  async findByDateRange(initial, final, includeScheduled) {
    return Array.from(entries.values()).filter((e) => {
      if (!includeScheduled && e.isScheduled) return false;
      return e.time >= initial && e.time < final;
    });
  },
  async findScheduled() {
    return Array.from(entries.values()).filter((e) => e.isScheduled);
  },
  async findOpenEntry(criteria) {
    return (
      Array.from(entries.values())
        .filter(
          (e) =>
            e.type === "Entrada" &&
            e.exited !== true &&
            e.name === criteria.name
        )
        .filter((e) =>
          criteria.isVisitor === undefined ? true : e.isVisitor === criteria.isVisitor
        )
        .filter((e) =>
          criteria.isPermissionario === undefined
            ? true
            : e.isPermissionario === criteria.isPermissionario
        )
        .sort((a, b) => b.time.getTime() - a.time.getTime())[0] ?? null
    );
  },
  async create(data) {
    const entry = {
      id: nextId++,
      ...data,
      isPermissionario: data.isPermissionario ?? false,
      exited: false,
      phoneNumber: data.phoneNumber ?? null,
      target: data.target ?? null,
      contactPerson: data.contactPerson ?? null,
      imagePath: data.imagePath ?? null,
      scheduledDate: data.scheduledDate ?? null,
    } as Entry;
    entries.set(entry.id, entry);
    return entry;
  },
  async update(id, data) {
    const entry = entries.get(id);
    if (!entry) throw { code: "P2025" };
    const updated = { ...entry, ...data } as Entry;
    entries.set(id, updated);
    return updated;
  },
};

const imageStorage = {
  saveVisitorImage: vi.fn(async (buffer: Buffer) => {
    return `/uploads/visitors/${buffer.length}.encrypted`;
  }),
};

const permissionarios = new Map<string, Entry>();

function makeEntry(data: Partial<Entry> & { name: string }): Entry {
  const entry = {
    id: nextId++,
    type: "Entrada",
    isVisitor: true,
    isPermissionario: false,
    isScheduled: data.isScheduled ?? false,
    name: data.name,
    idNumber: data.idNumber ?? "",
    licensePlate: data.licensePlate ?? "",
    carModel: data.carModel ?? "",
    time: data.time ?? new Date(),
    target: data.target ?? null,
    contactPerson: data.contactPerson ?? null,
    color: data.color ?? "",
    exited: data.exited ?? false,
    phoneNumber: data.phoneNumber ?? null,
    imagePath: data.imagePath ?? null,
    scheduledDate: data.scheduledDate ?? null,
  } as Entry;
  entries.set(entry.id, entry);
  return entry;
}

function reset() {
  entries.clear();
  permissionarios.clear();
  nextId = 1;
  imageStorage.saveVisitorImage.mockClear();
}

const baseVisitor: CreateEntryParsed = {
  type: "Entrada",
  isVisitor: true,
  isPermissionario: false,
  isScheduled: false,
  isMilitar: false,
  name: "Maria Souza",
  idNumber: "123456",
  CPF: undefined,
  licensePlate: "ABC1234",
  carModel: "Gol",
  color: "Prata",
  phoneNumber: "",
  contactPerson: "",
  target: "CIA MANUT",
};

function buildService(
  overrides: Partial<{
    repo: EntryRepository;
    storage: typeof imageStorage;
    findPermissionario: (cpf: string) => Promise<unknown>;
  }> = {}
) {
  return createEntryService({
    repository: overrides.repo ?? repository,
    imageStorage: overrides.storage ?? imageStorage,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    findPermissionarioByCpf: (overrides.findPermissionario ??
      (async () => null)) as any,
  });
}

describe("entry service", () => {
  beforeEach(reset);

  describe("createEntry", () => {
    it("registers a visitor entry with an image", async () => {
      const service = buildService();
      const entry = await service.createEntry(baseVisitor, {
        role: "Guarda",
        image: { buffer: Buffer.from("abc"), bytesRead: 3 },
      });

      expect(entry.name).toBe("Maria Souza");
      expect(entry.imagePath).toBe("/uploads/visitors/3.encrypted");
      expect(entries.size).toBe(1);
    });

    it("rejects a visitor entry without an image", async () => {
      const service = buildService();
      await expect(
        service.createEntry(baseVisitor, { role: "Guarda", image: null })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });

    it("denies entry registration for a non-authorised role", async () => {
      const service = buildService();
      await expect(
        service.createEntry(baseVisitor, {
          role: "Sta",
          image: { buffer: Buffer.from("abc"), bytesRead: 3 },
        })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("denies scheduled entry creation for a Guarda", async () => {
      const service = buildService();
      await expect(
        service.createEntry(
          { ...baseVisitor, isVisitor: false, isScheduled: true },
          { role: "Guarda", image: { buffer: Buffer.from("abc"), bytesRead: 3 } }
        )
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("reuses the permissionario image and fills missing fields", async () => {
      const service = buildService({
        findPermissionario: async (cpf) =>
          cpf === "11122233344"
            ? {
                completeName: "Pedro Permitido",
                idNumber: "99988877766",
                licensePlate: "XYZ9A87",
                carModel: "Onix",
                color: "Branco",
                local: "SEÇÃO S2",
                imagePath: "/images/perm/1.jpg",
              }
            : null,
      });

      const entry = await service.createEntry(
        {
          ...baseVisitor,
          isVisitor: false,
          isPermissionario: true,
          CPF: "11122233344",
          name: "",
          idNumber: "",
          licensePlate: "",
          carModel: "",
          color: "",
          target: "",
        },
        { role: "S2", image: null }
      );

      expect(entry.imagePath).toBe("/images/perm/1.jpg");
      expect(entry.name).toBe("Pedro Permitido");
      expect(entry.licensePlate).toBe("XYZ9A87");
      expect(entry.carModel).toBe("Onix");
      expect(entry.target).toBe("SEÇÃO S2");
    });

    it("requires CPF when registering a permissionario", async () => {
      const service = buildService();
      await expect(
        service.createEntry(
          { ...baseVisitor, isVisitor: false, isPermissionario: true },
          { role: "S2", image: null }
        )
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });

    it("conflicts when the person is already inside", async () => {
      makeEntry({ name: "Maria Souza", isVisitor: true, exited: false });
      const service = buildService();
      await expect(
        service.createEntry(baseVisitor, {
          role: "Guarda",
          image: { buffer: Buffer.from("abc"), bytesRead: 3 },
        })
      ).rejects.toMatchObject({ code: "CONFLICT" });
    });
  });

  describe("createExit", () => {
    it("registers an exit and marks the original entry as exited", async () => {
      const original = makeEntry({
        name: "Maria Souza",
        isVisitor: true,
        time: new Date(Date.now() - 2 * 3600 * 1000),
      });
      const service = buildService();

      const result = await service.createExit({
        entryId: original.id,
        name: "Maria Souza",
        isVisitor: true,
        isPermissionario: false,
      });

      expect(result.exit.type).toBe("Saída");
      expect(result.originalEntryUpdated).toBe(true);
      expect(entries.get(original.id)?.exited).toBe(true);
    });

    it("returns not found when the original entry does not exist", async () => {
      const service = buildService();
      await expect(
        service.createExit({ entryId: 999, name: "X", isVisitor: true, isPermissionario: false })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("rejects an exit when the entry was already marked as exited", async () => {
      const original = makeEntry({
        name: "Maria Souza",
        isVisitor: true,
        exited: true,
      });
      const service = buildService();
      await expect(
        service.createExit({ entryId: original.id, name: "Maria Souza", isVisitor: true, isPermissionario: false })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });
  });

  describe("createScheduledEntry", () => {
    it("rejects a scheduled date in the past", async () => {
      const service = buildService();
      await expect(
        service.createScheduledEntry({
          name: "João",
          idNumber: "123",
          scheduledDate: new Date(Date.now() - 5000),
        })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });

    it("creates a scheduled entry with a future date", async () => {
      const service = buildService();
      const future = new Date(Date.now() + 24 * 3600 * 1000);
      const created = await service.createScheduledEntry({
        name: "João",
        idNumber: "123",
        scheduledDate: future,
      });

      expect(created.isScheduled).toBe(true);
      expect(created.isVisitor).toBe(true);
      expect(created.imagePath).toBeNull();
    });
  });

  describe("confirmScheduledEntry", () => {
    it("forbids confirmation for a non-Guarda role", async () => {
      const scheduled = makeEntry({
        name: "João",
        isVisitor: true,
        isScheduled: true,
      });
      const service = buildService();
      await expect(
        service.confirmScheduledEntry(scheduled.id, {
          role: "S2",
          image: { buffer: Buffer.from("abc"), bytesRead: 3 },
        })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("rejects confirmation when the entry is not scheduled", async () => {
      const entry = makeEntry({ name: "João", isVisitor: true });
      const service = buildService();
      await expect(
        service.confirmScheduledEntry(entry.id, {
          role: "Guarda",
          image: { buffer: Buffer.from("abc"), bytesRead: 3 },
        })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });

    it("requires an image to confirm", async () => {
      const scheduled = makeEntry({
        name: "João",
        isVisitor: true,
        isScheduled: true,
      });
      const service = buildService();
      await expect(
        service.confirmScheduledEntry(scheduled.id, { role: "Guarda", image: null })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });

    it("confirms a scheduled entry with an image", async () => {
      const scheduled = makeEntry({
        name: "João",
        isVisitor: true,
        isScheduled: true,
      });
      const service = buildService();
      const updated = await service.confirmScheduledEntry(scheduled.id, {
        role: "Guarda",
        image: { buffer: Buffer.from("abc"), bytesRead: 3 },
      });

      expect(updated.isScheduled).toBe(false);
      expect(updated.imagePath).toBe("/uploads/visitors/3.encrypted");
    });
  });

  describe("getEntryById", () => {
    it("returns not found for a missing entry", async () => {
      const service = buildService();
      await expect(service.getById(999)).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    });
  });
});
