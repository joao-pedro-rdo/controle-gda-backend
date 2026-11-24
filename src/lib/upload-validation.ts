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
// Confere o conteúdo real do arquivo pelos primeiros bytes (assinatura),
// já que nome e mimetype vêm do cliente e podem ser forjados.
export function detectImageMimeType(buffer: Buffer): string | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return "image/png";
  }
  if (buffer.length >= 6 && /^GIF8[79]a$/.test(buffer.subarray(0, 6).toString("latin1"))) {
    return "image/gif";
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("latin1") === "RIFF" &&
    buffer.subarray(8, 12).toString("latin1") === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}
