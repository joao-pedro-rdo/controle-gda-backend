import type { PessoaNaoAutorizada } from "@prisma/client";

import { conflict, notFound } from "../lib/errors.js";
import {
  prismaPessoaNaoAutorizadaRepository,
  type PessoaNaoAutorizadaData,
  type PessoaNaoAutorizadaRepository,
} from "../repositories/pessoa-nao-autorizada-repository.js";
import type {
  CreatePessoaNaoAutorizadaInput,
  UpdatePessoaNaoAutorizadaInput,
} from "../schemas/pessoa-nao-autorizada-schema.js";
import {
  fsImageStorage,
  type ImageStorage,
} from "./image-storage-service.js";
import type { UploadedImage } from "../lib/multipart.js";

function hasPrismaCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === code
  );
}

export interface PessoaNaoAutorizadaImageOptions {
  image?: UploadedImage | null;
}

export interface PessoaNaoAutorizadaService {
  list(): Promise<PessoaNaoAutorizada[]>;
  getById(id: number): Promise<PessoaNaoAutorizada>;
  create(
    input: CreatePessoaNaoAutorizadaInput,
    opts?: PessoaNaoAutorizadaImageOptions
  ): Promise<PessoaNaoAutorizada>;
  update(
    id: number,
    input: UpdatePessoaNaoAutorizadaInput,
    opts?: PessoaNaoAutorizadaImageOptions
  ): Promise<PessoaNaoAutorizada>;
  remove(id: number): Promise<PessoaNaoAutorizada>;
}

export interface PessoaNaoAutorizadaServiceOptions {
  repository?: PessoaNaoAutorizadaRepository;
  imageStorage?: ImageStorage;
}

function toPessoaNaoAutorizadaData(
  input: CreatePessoaNaoAutorizadaInput
): PessoaNaoAutorizadaData {
  return {
    nome: input.nome,
    CPF: input.CPF,
    identidade: input.identidade ?? null,
    observacao: input.observacao ?? null,
    imagePath: null,
  };
}

export function createPessoaNaoAutorizadaService(
  options: PessoaNaoAutorizadaServiceOptions = {}
): PessoaNaoAutorizadaService {
  const repository =
    options.repository ?? prismaPessoaNaoAutorizadaRepository;
  const imageStorage = options.imageStorage ?? fsImageStorage;

  return {
    list() {
      return repository.findMany();
    },

    async getById(id) {
      const pessoa = await repository.findById(id);
      if (!pessoa) throw notFound("Pessoa não autorizada não encontrada");
      return pessoa;
    },

    async create(input, opts = {}) {
      const existing = await repository.findByCpf(input.CPF);
      if (existing) throw conflict("CPF já cadastrado");

      const data = toPessoaNaoAutorizadaData(input);
      if (opts.image) {
        data.imagePath = await imageStorage.saveUnauthorizedPersonImage(
          opts.image.buffer
        );
      }

      return repository.create(data);
    },

    async update(id, input, opts = {}) {
      const existing = await repository.findById(id);
      if (!existing) throw notFound("Pessoa não autorizada não encontrada");

      let imagePath = existing.imagePath;
      if (opts.image) {
        if (existing.imagePath) {
          await imageStorage.deleteImage(existing.imagePath);
        }
        imagePath = await imageStorage.saveUnauthorizedPersonImage(
          opts.image.buffer
        );
      }

      return repository.update(id, {
        ...input,
        imagePath,
      });
    },

    async remove(id) {
      const existing = await repository.findById(id);
      if (!existing) throw notFound("Pessoa não autorizada não encontrada");

      if (existing.imagePath) {
        await imageStorage.deleteImage(existing.imagePath);
      }

      try {
        return await repository.remove(id);
      } catch (error) {
        if (hasPrismaCode(error, "P2025")) {
          throw notFound("Pessoa não autorizada não encontrada");
        }
        throw error;
      }
    },
  };
}

export const pessoaNaoAutorizadaService =
  createPessoaNaoAutorizadaService();
