import {
  conflict,
  hasPrismaCode,
  notFound,
} from "../lib/errors.js";
import {
  prismaSettingsRepository,
  type SettingsRepository,
} from "../repositories/settings-repository.js";
import type {
  CreateDestinationInput,
  DestinationNameParams,
} from "../schemas/settings-schema.js";

export interface SettingsService {
  listDestinations(): Promise<string[]>;
  addDestination(input: CreateDestinationInput): Promise<string[]>;
  deleteDestination(params: DestinationNameParams): Promise<string[]>;
  resetDestinations(): Promise<string[]>;
}

export interface SettingsServiceOptions {
  repository?: SettingsRepository;
}

export function createSettingsService(
  options: SettingsServiceOptions = {}
): SettingsService {
  const repository = options.repository ?? prismaSettingsRepository;

  async function listDestinations(): Promise<string[]> {
    const destinations = await repository.listDestinations();
    return destinations.map((d) => d.name);
  }

  return {
    listDestinations,

    addDestination: async (input) => {
      try {
        await repository.createDestination(input.name);
      } catch (error) {
        if (hasPrismaCode(error, "P2002")) {
          throw conflict("Destino já existe");
        }
        throw error;
      }
      return listDestinations();
    },

    deleteDestination: async (params) => {
      try {
        await repository.deleteDestination(decodeURIComponent(params.name));
      } catch (error) {
        if (hasPrismaCode(error, "P2025")) {
          throw notFound("Destino não encontrado");
        }
        throw error;
      }
      return listDestinations();
    },

    resetDestinations: async () => {
      await repository.deleteCustomDestinations();
      return listDestinations();
    },
  };
}

export const settingsService = createSettingsService();