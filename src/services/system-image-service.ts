import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import {
  isSafeFilename,
  normalizeSystemImageName,
} from "../lib/upload-validation.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultSystemImagesDir = path.join(__dirname, "../../public/img");

export type SystemImageType = "logo" | "background";

const SYSTEM_IMAGE_PREFIXES = {
  logo: "logo",
  background: "bg-cover",
} as const satisfies Record<SystemImageType, string>;

export type SystemImagePrefix = (typeof SYSTEM_IMAGE_PREFIXES)[SystemImageType];

export interface StoredSystemImage {
  url: string;
  filename: string;
}

export interface SystemImageStorage {
  save(filename: string, buffer: Buffer): Promise<void>;
  removeMatching(prefix: string): Promise<string[]>;
  listFileNames(): Promise<string[]>;
  read(filename: string): Buffer | null;
}

export interface SystemImageService {
  upload(
    type: SystemImageType,
    buffer: Buffer,
    extension: string
  ): Promise<StoredSystemImage>;
  getCurrent(): Promise<{ logo: string | null; background: string | null }>;
  reset(type: SystemImageType): Promise<number>;
  read(filename: string): Promise<Buffer | null>;
}

export function createSystemImageService(
  storage: SystemImageStorage
): SystemImageService {
  return {
    async upload(type, buffer, extension) {
      const prefix = SYSTEM_IMAGE_PREFIXES[type];
      const filename = normalizeSystemImageName(prefix, extension);
      await storage.removeMatching(prefix);
      await storage.save(filename, buffer);
      return { url: `/system-images/${filename}`, filename };
    },

    async getCurrent() {
      const files = await storage.listFileNames();
      const logo =
        files.find((f) => f.startsWith(SYSTEM_IMAGE_PREFIXES.logo)) ?? null;
      const background =
        files.find((f) => f.startsWith(SYSTEM_IMAGE_PREFIXES.background)) ??
        null;
      return {
        logo: logo ? `/system-images/${logo}` : null,
        background: background ? `/system-images/${background}` : null,
      };
    },

    async reset(type) {
      const removed = await storage.removeMatching(SYSTEM_IMAGE_PREFIXES[type]);
      return removed.length;
    },

    async read(filename) {
      if (!isSafeFilename(filename)) return null;
      return storage.read(filename);
    },
  };
}

export function createFsSystemImageStorage(
  dir: string = defaultSystemImagesDir
): SystemImageStorage {
  return {
    async save(filename, buffer) {
      fs.mkdirSync(dir, { recursive: true });
      await fs.promises.writeFile(path.join(dir, filename), buffer);
    },

    async removeMatching(prefix) {
      if (!fs.existsSync(dir)) return [];
      const removed: string[] = [];
      for (const name of fs.readdirSync(dir)) {
        if (name.startsWith(prefix)) {
          await fs.promises.unlink(path.join(dir, name));
          removed.push(name);
        }
      }
      return removed;
    },

    async listFileNames() {
      if (!fs.existsSync(dir)) return [];
      return fs.readdirSync(dir).filter((name) => !name.startsWith("."));
    },

    read(filename) {
      if (!fs.existsSync(dir)) return null;
      const filePath = path.join(dir, filename);
      if (!fs.existsSync(filePath)) return null;
      return fs.readFileSync(filePath);
    },
  };
}

export const systemImageService = createSystemImageService(
  createFsSystemImageStorage()
);