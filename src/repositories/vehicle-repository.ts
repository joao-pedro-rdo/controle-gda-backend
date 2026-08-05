import type { Vehicles } from "@prisma/client";

import { prisma } from "../lib/prisma.js";

export interface VehicleData {
  completeName: string;
  tagName: string;
  carModel: string;
  licensePlate: string;
  color: string;
  driverLicense: string;
  idNumber: string;
  company: string;
  section: string;
}

export interface VehicleRepository {
  findMany(): Promise<Vehicles[]>;
  findById(id: number): Promise<Vehicles | null>;
  findByPlate(licensePlate: string): Promise<Vehicles | null>;
  create(data: VehicleData): Promise<Vehicles>;
  update(id: number, data: Partial<VehicleData>): Promise<Vehicles>;
  remove(id: number): Promise<Vehicles>;
}

export const prismaVehicleRepository: VehicleRepository = {
  findMany() {
    return prisma.vehicles.findMany();
  },

  findById(id) {
    return prisma.vehicles.findUnique({ where: { id } });
  },

  findByPlate(licensePlate) {
    return prisma.vehicles.findFirst({ where: { licensePlate } });
  },

  create(data) {
    return prisma.vehicles.create({ data });
  },

  update(id, data) {
    return prisma.vehicles.update({ where: { id }, data });
  },

  remove(id) {
    return prisma.vehicles.delete({ where: { id } });
  },
};
