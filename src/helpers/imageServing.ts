import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { FastifyReply } from "fastify";

import { decryptImage } from "./imageEncryption.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsRoot = path.join(__dirname, "../../uploads");

export interface StoredImageResult {
  buffer: Buffer;
  contentType: string;
}

export function storedImageDir(subdir: string): string {
  return path.join(uploadsRoot, subdir);
}

export function storedImageExists(subdir: string, filename: string): boolean {
  return fs.existsSync(path.join(storedImageDir(subdir), filename));
}

export function readStoredImage(
  subdir: string,
  filename: string
): StoredImageResult | null {
  if (!filename) return null;

  const dir = storedImageDir(subdir);
  const encryptedPath = path.join(dir, filename);
  const originalPath = path.join(dir, filename.replace(/\.encrypted$/, ""));

  let imagePath: string;
  let isEncrypted = false;

  if (fs.existsSync(encryptedPath) && filename.endsWith(".encrypted")) {
    imagePath = encryptedPath;
    isEncrypted = true;
  } else if (fs.existsSync(originalPath)) {
    imagePath = originalPath;
    isEncrypted = false;
  } else {
    return null;
  }

  let buffer: Buffer;
  let contentType = "image/jpeg";

  if (isEncrypted) {
    buffer = decryptImage(imagePath);
    if (buffer[0] === 0xff && buffer[1] === 0xd8) {
      contentType = "image/jpeg";
    } else if (buffer[0] === 0x89 && buffer[1] === 0x50) {
      contentType = "image/png";
    }
  } else {
    buffer = fs.readFileSync(imagePath);
  }

  return { buffer, contentType };
}

export function sendStoredImage(
  reply: FastifyReply,
  image: StoredImageResult
): FastifyReply {
  reply.headers({
    "Content-Type": image.contentType,
    "Cache-Control": "private, max-age=3600",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'",
  });
  return reply.send(image.buffer);
}