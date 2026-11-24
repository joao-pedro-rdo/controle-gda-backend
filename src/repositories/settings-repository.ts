import type { Destination } from "@prisma/client";

import { prisma } from "../lib/prisma.js";

export interface SettingsRepository {
  listDestinations(): Promise<Destination[]>;
  createDestination(name: string): Promise<Destination>;
  deleteDestination(name: string): Promise<Destination>;
  deleteCustomDestinations(): Promise<{ count: number }>;
}

export const prismaSettingsRepository: SettingsRepository = {
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