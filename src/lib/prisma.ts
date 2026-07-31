import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  __prismaClient?: PrismaClient;
};

export const prisma = globalForPrisma.__prismaClient ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__prismaClient = prisma;
}

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}
