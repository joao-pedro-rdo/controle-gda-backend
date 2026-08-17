import type { PessoaNaoAutorizada } from "@prisma/client";

import { prisma } from "../lib/prisma.js";

export interface PessoaNaoAutorizadaData {
  nome: string;
  CPF: string;
  identidade: string | null;
  observacao: string | null;
  imagePath: string | null;
}

export interface PessoaNaoAutorizadaRepository {
  findMany(): Promise<PessoaNaoAutorizada[]>;
  findById(id: number): Promise<PessoaNaoAutorizada | null>;
  findByCpf(cpf: string): Promise<PessoaNaoAutorizada | null>;
  create(data: PessoaNaoAutorizadaData): Promise<PessoaNaoAutorizada>;
  update(
    id: number,
    data: Partial<PessoaNaoAutorizadaData>
  ): Promise<PessoaNaoAutorizada>;
  remove(id: number): Promise<PessoaNaoAutorizada>;
}

export const prismaPessoaNaoAutorizadaRepository: PessoaNaoAutorizadaRepository = {
  findMany() {
    return prisma.pessoaNaoAutorizada.findMany({
      orderBy: { createdAt: "desc" },
    });
  },

  findById(id) {
    return prisma.pessoaNaoAutorizada.findUnique({ where: { id } });
  },

  findByCpf(cpf) {
    return prisma.pessoaNaoAutorizada.findUnique({ where: { CPF: cpf } });
  },

  create(data) {
    return prisma.pessoaNaoAutorizada.create({ data });
  },

  update(id, data) {
    return prisma.pessoaNaoAutorizada.update({ where: { id }, data });
  },

  remove(id) {
    return prisma.pessoaNaoAutorizada.delete({ where: { id } });
  },
};