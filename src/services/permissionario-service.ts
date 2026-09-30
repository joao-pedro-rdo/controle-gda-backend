import type { Permissionario } from "@prisma/client";

import { conflict, hasPrismaCode, notFound } from "../lib/errors.js";
import {
  prismaPermissionarioRepository,
  type PermissionarioData,
  type PermissionarioRepository,
} from "../repositories/permissionario-repository.js";
import type {
  CreatePermissionarioInput,
  UpdatePermissionarioInput,
} from "../schemas/permissionario-schema.js";
import {
  fsImageStorage,
  type ImageStorage,
} from "./image-storage-service.js";
import type { UploadedImage } from "../lib/multipart.js";

export interface PermissionarioImageOptions {
  image?: UploadedImage | null;
  removeImage?: boolean;
}

export interface PermissionarioService {
  list(): Promise<Permissionario[]>;
  getById(id: number): Promise<Permissionario>;
  getByCpf(cpf: string): Promise<Permissionario>;
  create(
    input: CreatePermissionarioInput,
    opts?: PermissionarioImageOptions
  ): Promise<Permissionario>;
  update(
    id: number,
    input: UpdatePermissionarioInput,
    opts?: PermissionarioImageOptions
  ): Promise<Permissionario>;
  remove(id: number): Promise<Permissionario>;
}

export interface PermissionarioServiceOptions {
  repository?: PermissionarioRepository;
  imageStorage?: ImageStorage;
}

function toPermissionarioData(input: CreatePermissionarioInput): PermissionarioData {
  return {
    completeName: input.completeName,
    idNumber: input.idNumber,
    CPF: input.CPF,
    local: input.local ?? null,
    carModel: input.carModel ?? null,
    licensePlate: input.licensePlate ?? null,
    color: input.color ?? null,
    imagePath: null,
  };
}

export function createPermissionarioService(
  options: PermissionarioServiceOptions = {}
): PermissionarioService {
  const repository = options.repository ?? prismaPermissionarioRepository;
  const imageStorage = options.imageStorage ?? fsImageStorage;

  return {
    list() {
      return repository.findMany();
    },

    async getById(id) {
      const permissionario = await repository.findById(id);
      if (!permissionario) throw notFound("Permissionário não encontrado");
      return permissionario;
    },

    async getByCpf(cpf) {
      const permissionario = await repository.findByCpf(cpf);
      if (!permissionario) throw notFound("Permissionário não encontrado");
      return permissionario;
    },

    async create(input, opts = {}) {
      const existing = await repository.findByCpf(input.CPF);
      if (existing) throw conflict("CPF já cadastrado");

      const data = toPermissionarioData(input);
      if (opts.image) {
        data.imagePath = await imageStorage.savePermissionarioImage(
          opts.image.buffer
        );
      }

      return repository.create(data);
    },

    async update(id, input, opts = {}) {
      const existing = await repository.findById(id);
      if (!existing) throw notFound("Permissionário não encontrado");

      let imagePath = existing.imagePath;
      if (opts.image) {
        if (existing.imagePath) {
          await imageStorage.deleteImage(existing.imagePath);
        }
        imagePath = await imageStorage.savePermissionarioImage(opts.image.buffer);
      } else if (opts.removeImage) {
        if (existing.imagePath) {
          await imageStorage.deleteImage(existing.imagePath);
        }
        imagePath = null;
      }

      return repository.update(id, {
        ...input,
        imagePath,
      });
    },

    async remove(id) {
      const existing = await repository.findById(id);
      if (!existing) throw notFound("Permissionário não encontrado");

      if (existing.imagePath) {
        await imageStorage.deleteImage(existing.imagePath);
      }

      try {
        return await repository.remove(id);
      } catch (error) {
        if (hasPrismaCode(error, "P2025")) throw notFound("Permissionário não encontrado");
        throw error;
      }
    },
  };
}

export const permissionarioService = createPermissionarioService();
