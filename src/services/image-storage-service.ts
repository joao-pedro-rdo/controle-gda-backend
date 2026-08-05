import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { encryptImage } from "../helpers/imageEncryption.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const visitorsDir = path.join(__dirname, "../../uploads/visitors");

export interface ImageStorage {
  saveVisitorImage(buffer: Buffer): Promise<string>;
}

export const fsImageStorage: ImageStorage = {
  async saveVisitorImage(buffer) {
    fs.mkdirSync(visitorsDir, { recursive: true });
    const fileName = `visitor_${Date.now()}.jpg`;
    const filePath = path.join(visitorsDir, fileName);
    await fs.promises.writeFile(filePath, buffer);
    encryptImage(filePath);
    return `/uploads/visitors/${fileName}.encrypted`;
  },
};
