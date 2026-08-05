import type { Entry } from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import { badRequest, conflict, forbidden, notFound } from "../lib/errors.js";
import {
  incrementEntryCounter,
  incrementExitCounter,
  incrementImageUpload,
  incrementScheduledEntry,
  recordStayDuration,
} from "../helpers/prometheus.js";
import {
  prismaEntryRepository,
  type EntryRepository,
} from "../repositories/entry-repository.js";
import { fsImageStorage, type ImageStorage } from "./image-storage-service.js";
import type {
  CreateEntryParsed,
  CreateExitInput,
  CreateScheduledEntryInput,
  DateRangeQuery,
} from "../schemas/entries-schema.js";

interface PermissionarioLike {
  completeName?: string | null;
  idNumber?: string | null;
  licensePlate?: string | null;
  carModel?: string | null;
  color?: string | null;
  local?: string | null;
  imagePath?: string | null;
}

type FindPermissionario = (cpf: string) => Promise<PermissionarioLike | null>;

const findPermissionarioByCpfDefault: FindPermissionario = (cpf) =>
  prisma.permissionario.findFirst({
    where: { CPF: cpf },
  });

export interface EntryImageInput {
  buffer: Buffer;
  bytesRead: number;
}

export interface EntryServiceOptions {
  repository?: EntryRepository;
  imageStorage?: ImageStorage;
  findPermissionarioByCpf?: FindPermissionario;
}

const ENTRY_ROLES = ["Guarda", "S2", "SFPC"];
const SCHEDULING_ROLES = ["S2", "SFPC"];

export interface EntryService {
  index(): Promise<Entry[]>;
  getById(id: number): Promise<Entry>;
  getEntriesByDate(input: DateRangeQuery): Promise<Entry[]>;
  getScheduledEntries(date?: Date): Promise<Entry[]>;
  getScheduledEntriesByDateRange(input: DateRangeQuery): Promise<Entry[]>;
  createEntry(
    input: CreateEntryParsed,
    opts: { role: string; image?: EntryImageInput | null }
  ): Promise<Entry>;
  createExit(input: CreateExitInput): Promise<{
    exit: Entry;
    originalEntryUpdated: boolean;
  }>;
  createScheduledEntry(input: CreateScheduledEntryInput): Promise<Entry>;
  confirmScheduledEntry(
    id: number,
    opts: { role: string; image?: EntryImageInput | null }
  ): Promise<Entry>;
  markExited(id: number, exited: boolean): Promise<Entry>;
}

function entryTypeLabel(
  isPermissionario: boolean,
  isMilitar: boolean,
  isVisitor: boolean
): string {
  if (isPermissionario) return "permissionario";
  if (isMilitar) return "militar";
  if (isVisitor) return "visitor";
  return "visitor";
}

export function createEntryService(
  options: EntryServiceOptions = {}
): EntryService {
  const repository = options.repository ?? prismaEntryRepository;
  const imageStorage = options.imageStorage ?? fsImageStorage;
  const findPermissionarioByCpf =
    options.findPermissionarioByCpf ?? findPermissionarioByCpfDefault;

  return {
    index() {
      return repository.findMany();
    },

    async getById(id) {
      const entry = await repository.findById(id);
      if (!entry) throw notFound("Entrada não encontrada");
      return entry;
    },

    getEntriesByDate(input) {
      return repository.findByDateRange(
        input.initialDate,
        input.finalDate,
        input.includeScheduled ?? false
      );
    },

    getScheduledEntries(date) {
      return repository.findScheduled(date ? { date } : {});
    },

    getScheduledEntriesByDateRange(input) {
      return repository.findScheduled({
        initial: input.initialDate,
        final: input.finalDate,
      });
    },

    async createEntry(input, opts) {
      const isScheduled = input.isScheduled;
      if (isScheduled) {
        if (!SCHEDULING_ROLES.includes(opts.role)) {
          throw forbidden("Permissão negada para agendamentos");
        }
      } else if (!ENTRY_ROLES.includes(opts.role)) {
        throw forbidden("Permissão negada para entradas");
      }

      if (input.isPermissionario && !input.CPF) {
        throw badRequest("CPF é obrigatório para permissionários");
      }

      const isExit = input.type === "Saída";
      let imagePath: string | null = null;

      if (isExit) {
        const source = await repository.findOpenEntry({
          name: input.name,
          isVisitor: input.isVisitor ? true : undefined,
          isPermissionario: input.isPermissionario ? true : undefined,
        });
        if (source?.imagePath) imagePath = source.imagePath;
      }

      let name = input.name;
      let idNumber = input.idNumber ?? "";
      let licensePlate = input.licensePlate;
      let carModel = input.carModel;
      let color = input.color ?? "";
      let target = input.target ?? "";

      if (input.isPermissionario && input.CPF) {
        const permissionario = await findPermissionarioByCpf(input.CPF);
        if (permissionario) {
          if (permissionario.imagePath) imagePath = permissionario.imagePath;
          if (!name) name = permissionario.completeName ?? "";
          if (!idNumber) idNumber = permissionario.idNumber ?? "";
          if (!licensePlate) licensePlate = permissionario.licensePlate ?? "N/A";
          if (!carModel) carModel = permissionario.carModel ?? "N/A";
          if (!color) color = permissionario.color ?? "N/A";
          if (!target) target = permissionario.local ?? "";
        }
      }

      if (input.isVisitor && !imagePath && !opts.image && !isExit) {
        throw badRequest("Imagem é obrigatória para visitantes (exceto saídas)");
      }

      if (!isScheduled && !isExit && (input.isVisitor || input.isPermissionario)) {
        const open = await repository.findOpenEntry({
          name,
          isVisitor: input.isVisitor ? true : undefined,
          isPermissionario: input.isPermissionario ? true : undefined,
        });
        if (open) {
          throw conflict("Esta pessoa já está dentro da OM");
        }
      }

      if (!imagePath && opts.image) {
        imagePath = await imageStorage.saveVisitorImage(opts.image.buffer);
        incrementImageUpload("visitor", "success", opts.image.bytesRead);
      }

      const entry = await repository.create({
        type: input.type,
        isVisitor: input.isVisitor,
        isPermissionario: input.isPermissionario,
        isScheduled,
        scheduledDate: null,
        name,
        idNumber,
        licensePlate: licensePlate ?? "",
        carModel: carModel ?? "",
        time: new Date(),
        target: target ?? null,
        contactPerson: input.contactPerson ?? null,
        color: color ?? "",
        phoneNumber: input.phoneNumber ?? null,
        imagePath,
      });

      if (!isExit) {
        const type = entryTypeLabel(
          input.isPermissionario,
          input.isMilitar,
          input.isVisitor
        );
        incrementEntryCounter(type, isScheduled, "success");
      }

      return entry;
    },

    async createExit(input) {
      const originalEntry = await repository.findById(input.entryId);
      if (!originalEntry) throw notFound("Entrada original não encontrada");
      if (originalEntry.exited) {
        throw badRequest("Esta entrada já foi marcada como saída");
      }

      const exitType = input.isPermissionario ? "permissionario" : "visitor";

      const exit = await repository.create({
        type: "Saída",
        isVisitor: input.isVisitor,
        isPermissionario: input.isPermissionario,
        isScheduled: false,
        name: input.name,
        idNumber: input.idNumber ?? "",
        licensePlate: input.licensePlate ?? "",
        carModel: input.carModel ?? "",
        time: new Date(),
        target: input.target ?? null,
        contactPerson: input.contactPerson ?? null,
        color: input.color ?? "",
        phoneNumber: input.phoneNumber ?? null,
        imagePath: input.imagePath ?? null,
      });

      await repository.update(originalEntry.id, { exited: true });

      incrementExitCounter(exitType);
      if (originalEntry.time) {
        const stayHours =
          (Date.now() - new Date(originalEntry.time).getTime()) /
          (1000 * 60 * 60);
        recordStayDuration(exitType, stayHours);
      }

      return { exit, originalEntryUpdated: true };
    },

    async createScheduledEntry(input) {
      if (input.scheduledDate <= new Date()) {
        throw badRequest("A data e hora do agendamento deve ser futura");
      }

      const agendamento = await repository.create({
        type: "Entrada",
        isVisitor: true,
        isPermissionario: false,
        isScheduled: true,
        scheduledDate: input.scheduledDate,
        name: input.name,
        idNumber: input.idNumber,
        licensePlate: input.licensePlate ?? "",
        carModel: input.carModel ?? "",
        time: new Date(),
        target: input.target ?? null,
        contactPerson: input.contactPerson ?? null,
        color: input.color ?? "",
        phoneNumber: input.phoneNumber ?? null,
        imagePath: null,
      });

      incrementScheduledEntry("created");
      return agendamento;
    },

    async confirmScheduledEntry(id, opts) {
      if (opts.role !== "Guarda") {
        throw forbidden(
          "Permissão negada - apenas Guardas podem confirmar agendamentos"
        );
      }

      const scheduled = await repository.findById(id);
      if (!scheduled) throw notFound("Agendamento não encontrado");
      if (!scheduled.isScheduled) {
        throw badRequest("Esta entrada não é um agendamento");
      }
      if (!opts.image) {
        throw badRequest("Imagem é obrigatória para confirmar agendamento");
      }

      const imagePath = await imageStorage.saveVisitorImage(opts.image.buffer);
      incrementImageUpload("visitor", "success", opts.image.bytesRead);

      const updated = await repository.update(id, {
        isScheduled: false,
        time: new Date(),
        imagePath,
      });

      incrementScheduledEntry("confirmed");
      return updated;
    },

    async markExited(id, exited) {
      const entry = await repository.findById(id);
      if (!entry) throw notFound("Entrada não encontrada");

      const updated = await repository.update(id, { exited });

      if (exited && !entry.exited) {
        const type = entry.isPermissionario
          ? "permissionario"
          : entry.isVisitor
          ? "visitor"
          : "visitor";
        incrementExitCounter(type);
        if (entry.time) {
          const stayHours =
            (Date.now() - new Date(entry.time).getTime()) /
            (1000 * 60 * 60);
          recordStayDuration(type, stayHours);
        }
      }

      return updated;
    },
  };
}

export const entryService = createEntryService();
