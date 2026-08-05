import type { Entry } from "@prisma/client";

import { prisma } from "../lib/prisma.js";

export interface EntryCreateData {
  type: string;
  isVisitor: boolean;
  isPermissionario: boolean;
  isScheduled: boolean;
  scheduledDate?: Date | null;
  name: string;
  idNumber: string;
  licensePlate: string;
  carModel: string;
  time: Date;
  target?: string | null;
  contactPerson?: string | null;
  color: string;
  phoneNumber?: string | null;
  imagePath?: string | null;
}

export interface EntryUpdateData {
  exited?: boolean;
  isScheduled?: boolean;
  time?: Date;
  imagePath?: string | null;
  scheduledDate?: Date | null;
}

export interface OpenEntryCriteria {
  name: string;
  isVisitor?: boolean;
  isPermissionario?: boolean;
}

export interface ScheduledRange {
  initial?: Date;
  final?: Date;
  date?: Date;
}

export interface EntryRepository {
  findMany(): Promise<Entry[]>;
  findById(id: number): Promise<Entry | null>;
  findByDateRange(
    initial: Date,
    final: Date,
    includeScheduled: boolean
  ): Promise<Entry[]>;
  findScheduled(range?: ScheduledRange): Promise<Entry[]>;
  findOpenEntry(criteria: OpenEntryCriteria): Promise<Entry | null>;
  create(data: EntryCreateData): Promise<Entry>;
  update(id: number, data: EntryUpdateData): Promise<Entry>;
}

export const prismaEntryRepository: EntryRepository = {
  findMany() {
    return prisma.entry.findMany();
  },

  findById(id) {
    return prisma.entry.findUnique({ where: { id } });
  },

  findByDateRange(initial, final, includeScheduled) {
    return prisma.entry.findMany({
      where: {
        time: { gte: initial, lt: final },
        ...(includeScheduled ? {} : { isScheduled: false }),
      },
      orderBy: { id: "asc" },
    });
  },

  findScheduled(range) {
    const where: Record<string, unknown> = {
      isScheduled: true,
      type: "Entrada",
    };

    if (range?.date) {
      const end = new Date(range.date);
      end.setDate(end.getDate() + 1);
      where.scheduledDate = { gte: range.date, lt: end };
    } else if (range?.initial && range?.final) {
      where.scheduledDate = { gte: range.initial, lt: range.final };
    }

    return prisma.entry.findMany({
      where,
      orderBy: { scheduledDate: "asc" },
    });
  },

  findOpenEntry(criteria) {
    return prisma.entry.findFirst({
      where: {
        type: "Entrada",
        exited: { not: true },
        name: criteria.name,
        ...(criteria.isVisitor === undefined
          ? {}
          : { isVisitor: criteria.isVisitor }),
        ...(criteria.isPermissionario === undefined
          ? {}
          : { isPermissionario: criteria.isPermissionario }),
      },
      orderBy: { time: "desc" },
    });
  },

  create(data) {
    return prisma.entry.create({ data });
  },

  update(id, data) {
    return prisma.entry.update({ where: { id }, data });
  },
};
