import type { Permissionario } from "@prisma/client";

import { prisma } from "../lib/prisma.js";

export interface PermissionarioData {
  completeName: string;
  idNumber: string;
  CPF: string;
  local: string | null;
  carModel: string | null;
  licensePlate: string | null;
  color: string | null;
  imagePath: string | null;
}

export interface PermissionarioRepository {
  findMany(): Promise<Permissionario[]>;
  findById(id: number): Promise<Permissionario | null>;
  findByCpf(cpf: string): Promise<Permissionario | null>;
  create(data: PermissionarioData): Promise<Permissionario>;
  update(
    id: number,
    data: Partial<PermissionarioData>
  ): Promise<Permissionario>;
  remove(id: number): Promise<Permissionario>;
}

export const prismaPermissionarioRepository: PermissionarioRepository = {
  findMany() {
    return prisma.permissionario.findMany();
  },

  findById(id) {
    return prisma.permissionario.findUnique({ where: { id } });
  },

  findByCpf(cpf) {
    return prisma.permissionario.findFirst({ where: { CPF: cpf } });
  },

  create(data) {
    return prisma.permissionario.create({ data });
  },

  update(id, data) {
    return prisma.permissionario.update({ where: { id }, data });
  },

  remove(id) {
    return prisma.permissionario.delete({ where: { id } });
  },
};
