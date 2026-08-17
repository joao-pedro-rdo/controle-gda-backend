import type { FastifyRequest } from "fastify";
import type { MultipartFile } from "@fastify/multipart";

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
      image = { buffer, bytesRead: buffer.length };
    } else if (part.type === "field") {
      form[part.fieldname] = String(part.value).trim();
    }
  }

  return { form, image };
}
