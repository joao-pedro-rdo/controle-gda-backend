import path from "path";

export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB, mantém paridade com @fastify/multipart

const ALLOWED_IMAGE_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
] as const;

const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
] as const;

export interface ImageUploadInfo {
  filename: string;
  mimetype: string;
  size: number;
}

export type ImageUploadValidation =
  | { ok: true; extension: string; mimeType: string }
  | { ok: false; reason: string };

export function validateImageUpload(
  file: ImageUploadInfo | undefined
): ImageUploadValidation {
  if (!file) return { ok: false, reason: "Nenhum arquivo enviado" };

  if (file.size > MAX_FILE_SIZE) {
    return { ok: false, reason: "Arquivo excede o limite de 5MB" };
  }

  const mimeType = file.mimetype;
  if (
    !(ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(mimeType)
  ) {
    return { ok: false, reason: "Tipo de arquivo não permitido" };
  }

  const extension = path.extname(file.filename).toLowerCase();
  if (
    !(ALLOWED_IMAGE_EXTENSIONS as readonly string[]).includes(extension)
  ) {
    return { ok: false, reason: "Extensão não permitida" };
  }

  return { ok: true, extension, mimeType };
}

export function normalizeSystemImageName(
  prefix: "logo" | "bg-cover",
  extension: string
): string {
  return `${prefix}${extension}`;
}

export function contentTypeForExtension(extension: string): string {
  switch (extension) {
    case ".png":
      return "image/png";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    case ".jpg":
    case ".jpeg":
    default:
      return "image/jpeg";
  }
}

export function isSafeFilename(filename: string): boolean {
  return (
    !filename.includes("..") &&
    !filename.includes("/") &&
    !filename.includes("\\")
  );
}