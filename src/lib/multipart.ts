import type { FastifyRequest } from "fastify";
import type { MultipartFile } from "@fastify/multipart";

import { badRequest } from "./errors.js";
import { detectImageMimeType, validateImageUpload } from "./upload-validation.js";

export interface UploadedImage {
  buffer: Buffer;
  bytesRead: number;
}

export interface MultipartResult {
  form: Record<string, string>;
  image: UploadedImage | null;
}

export async function readMultipartForm(
  request: FastifyRequest
): Promise<MultipartResult> {
  const parts = request.parts();
  const form: Record<string, string> = {};
  let image: UploadedImage | null = null;

  for await (const part of parts) {
    if (part.type === "file" && part.fieldname === "image") {
      const file = part as MultipartFile;
      const buffer = await file.toBuffer();
      image = validateUploadedImage(file, buffer);
    } else if (part.type === "field") {
      form[part.fieldname] = String(part.value).trim();
    }
  }

  return { form, image };
}

// Imagens de visitante, permissionário e pessoa não autorizada: extensão,
// mimetype, tamanho e conteúdo real precisam ser de imagem.
function validateUploadedImage(file: MultipartFile, buffer: Buffer): UploadedImage {
  if (file.file.truncated) {
    throw badRequest("Arquivo excede o limite de 5MB");
  }
  const check = validateImageUpload({
    filename: file.filename,
    mimetype: file.mimetype,
    size: buffer.length,
  });
  if ("reason" in check) throw badRequest(check.reason);
  if (buffer.length === 0 || !detectImageMimeType(buffer)) {
    throw badRequest("O arquivo enviado não é uma imagem válida");
  }
  return { buffer, bytesRead: buffer.length };
}
