import type { Destination, SystemSettings } from "@prisma/client";

import { prisma } from "../lib/prisma.js";

export interface SettingsRepository {
  getByKeys(keys: string[]): Promise<SystemSettings[]>;
  set(key: string, value: string | null): Promise<SystemSettings>;
  listDestinations(): Promise<Destination[]>;
  createDestination(name: string): Promise<Destination>;
  deleteDestination(name: string): Promise<Destination>;
  deleteCustomDestinations(): Promise<{ count: number }>;
}

export const prismaSettingsRepository: SettingsRepository = {
  getByKeys(keys) {
    return prisma.systemSettings.findMany({
      where: { settingKey: { in: keys } },
    });
  },

  set(key, value) {
    return prisma.systemSettings.upsert({
      where: { settingKey: key },
      update: { settingValue: value },
      create: { settingKey: key, settingValue: value },
    });
  },

  listDestinations() {
    return prisma.destination.findMany({
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    });
  },

  createDestination(name) {
    return prisma.destination.create({ data: { name, isDefault: false } });
  },

  deleteDestination(name) {
    return prisma.destination.delete({ where: { name } });
  },

  deleteCustomDestinations() {
    return prisma.destination.deleteMany({ where: { isDefault: false } });
  },
};