import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { encryptImage } from "../helpers/imageEncryption.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadsRoot = path.join(__dirname, "../../uploads");

export interface ImageStorage {
  saveVisitorImage(buffer: Buffer): Promise<string>;
  savePermissionarioImage(buffer: Buffer): Promise<string>;
  saveUnauthorizedPersonImage(buffer: Buffer): Promise<string>;
  deleteImage(imagePath: string | null): Promise<void>;
}

function resolveStoredPath(storedPath: string): string {
  const relative = storedPath.replace(/^\/uploads\//, "");
  return path.join(uploadsRoot, relative);
}

function createSaver(subdir: string, prefix: string) {
  return async (buffer: Buffer): Promise<string> => {
    const dir = path.join(uploadsRoot, subdir);
    fs.mkdirSync(dir, { recursive: true });
    const fileName = `${prefix}_${Date.now()}.jpg`;
    const filePath = path.join(dir, fileName);
    await fs.promises.writeFile(filePath, buffer);
    encryptImage(filePath);
    return `/uploads/${subdir}/${fileName}.encrypted`;
  };
}

export const fsImageStorage: ImageStorage = {
  saveVisitorImage: createSaver("visitors", "visitor"),
  savePermissionarioImage: createSaver("permissionarios", "permissionario"),
  saveUnauthorizedPersonImage: createSaver(
    "pessoas-nao-autorizadas",
    "pessoa_nao_autorizada"
  ),

  async deleteImage(imagePath) {
    if (!imagePath) return;
    const filePath = resolveStoredPath(imagePath);
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }
  },
};
