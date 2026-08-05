import type { Vehicles } from "@prisma/client";

import { conflict, notFound } from "../lib/errors.js";
import {
  prismaVehicleRepository,
  type VehicleData,
  type VehicleRepository,
} from "../repositories/vehicle-repository.js";
import type {
  CreateVehicleInput,
  UpdateVehicleInput,
} from "../schemas/vehicles-schema.js";

function hasPrismaCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === code
  );
}

function toVehicleData(input: CreateVehicleInput): VehicleData {
  return {
    completeName: input.completeName,
    tagName: input.tagName,
    carModel: input.carModel,
    licensePlate: input.licensePlate,
    color: input.color,
    driverLicense: input.driverLicense ?? "",
    idNumber: input.idNumber,
    company: input.company ?? "",
    section: input.section ?? "",
  };
}

export interface VehicleService {
  list(): Promise<Vehicles[]>;
  getById(id: number): Promise<Vehicles>;
  getByPlate(licensePlate: string): Promise<Vehicles>;
  create(input: CreateVehicleInput): Promise<Vehicles>;
  update(id: number, input: UpdateVehicleInput): Promise<Vehicles>;
  remove(id: number): Promise<Vehicles>;
}

export function createVehicleService(
  repository: VehicleRepository = prismaVehicleRepository
): VehicleService {
  return {
    list() {
      return repository.findMany();
    },

    async getById(id) {
      const vehicle = await repository.findById(id);
      if (!vehicle) throw notFound("Veículo não encontrado");
      return vehicle;
    },

    async getByPlate(licensePlate) {
      const vehicle = await repository.findByPlate(licensePlate);
      if (!vehicle) throw notFound("Veículo não encontrado");
      return vehicle;
    },

    async create(input) {
      const existing = await repository.findByPlate(input.licensePlate);
      if (existing) throw conflict("Já existe um veículo com esta placa");
      return repository.create(toVehicleData(input));
    },

    async update(id, input) {
      try {
        return await repository.update(id, input);
      } catch (error) {
        if (hasPrismaCode(error, "P2025")) throw notFound("Veículo não encontrado");
        throw error;
      }
    },

    async remove(id) {
      try {
        return await repository.remove(id);
      } catch (error) {
        if (hasPrismaCode(error, "P2025")) throw notFound("Veículo não encontrado");
        throw error;
      }
    },
  };
}

export const vehicleService = createVehicleService();
