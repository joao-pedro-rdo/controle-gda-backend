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
  UpdateColorsInput,
  UpdateSystemSettingsInput,
} from "../schemas/settings-schema.js";

const DEFAULT_PAGE_TITLE =
  process.env.DEFAULT_PAGE_TITLE || "Guarda - 6° RCB";
const DEFAULT_LOGO_PATH = process.env.DEFAULT_LOGO_PATH || "/img/logo.png";
const DEFAULT_BACKGROUND_PATH =
  process.env.DEFAULT_BACKGROUND_PATH || "/img/bg-cover.jpg";
const DEFAULT_PRIMARY_COLOR = "#dc2626";
const DEFAULT_SECONDARY_COLOR = "#991b1b";

export interface SystemColors {
  primaryColor: string;
  secondaryColor: string;
}

export interface SystemSettingsView {
  pageTitle: string;
  logo: string;
  background: string;
}

export interface SettingsService {
  getColors(): Promise<SystemColors>;
  updateColors(input: UpdateColorsInput): Promise<SystemColors>;
  getSystemSettings(): Promise<SystemSettingsView>;
  updateSystemSettings(input: UpdateSystemSettingsInput): Promise<SystemSettingsView>;
  resetSystemSettings(): Promise<SystemSettingsView>;
  listDestinations(): Promise<string[]>;
  addDestination(input: CreateDestinationInput): Promise<string[]>;
  deleteDestination(params: DestinationNameParams): Promise<string[]>;
  resetDestinations(): Promise<string[]>;
}

export interface SettingsServiceOptions {
  repository?: SettingsRepository;
}

function toSettingsMap(rows: { settingKey: string; settingValue: string | null }[]): Record<string, string | null> {
  return rows.reduce<Record<string, string | null>>((acc, row) => {
    acc[row.settingKey] = row.settingValue;
    return acc;
  }, {});
}

export function createSettingsService(
  options: SettingsServiceOptions = {}
): SettingsService {
  const repository = options.repository ?? prismaSettingsRepository;

  async function getColors(): Promise<SystemColors> {
    const rows = await repository.getByKeys([
      "primary_color",
      "secondary_color",
    ]);
    const config = toSettingsMap(rows);
    return {
      primaryColor: config.primary_color || DEFAULT_PRIMARY_COLOR,
      secondaryColor: config.secondary_color || DEFAULT_SECONDARY_COLOR,
    };
  }

  async function getSystemSettings(): Promise<SystemSettingsView> {
    const rows = await repository.getByKeys([
      "page_title",
      "logo_path",
      "background_path",
    ]);
    const config = toSettingsMap(rows);
    return {
      pageTitle: config.page_title || DEFAULT_PAGE_TITLE,
      logo: config.logo_path || DEFAULT_LOGO_PATH,
      background: config.background_path || DEFAULT_BACKGROUND_PATH,
    };
  }

  async function listDestinations(): Promise<string[]> {
    const destinations = await repository.listDestinations();
    return destinations.map((d) => d.name);
  }

  return {
    getColors,
    updateColors: async (input) => {
      if (input.primaryColor !== undefined) {
        await repository.set("primary_color", input.primaryColor);
      }
      if (input.secondaryColor !== undefined) {
        await repository.set("secondary_color", input.secondaryColor);
      }
      return getColors();
    },

    getSystemSettings,

    updateSystemSettings: async (input) => {
      if (input.pageTitle !== undefined) {
        await repository.set("page_title", input.pageTitle);
      }
      if (input.logo !== undefined) {
        await repository.set("logo_path", input.logo);
      }
      if (input.background !== undefined) {
        await repository.set("background_path", input.background);
      }
      return getSystemSettings();
    },

    resetSystemSettings: async () => {
      await repository.set("page_title", DEFAULT_PAGE_TITLE);
      await repository.set("logo_path", DEFAULT_LOGO_PATH);
      await repository.set("background_path", DEFAULT_BACKGROUND_PATH);
      return {
        pageTitle: DEFAULT_PAGE_TITLE,
        logo: DEFAULT_LOGO_PATH,
        background: DEFAULT_BACKGROUND_PATH,
      };
    },

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