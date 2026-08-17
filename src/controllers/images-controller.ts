import type { FastifyReply, FastifyRequest } from "fastify";
import path from "path";

import {
  imageFilenameParamsSchema,
  systemImageTypeParamsSchema,
} from "../schemas/images-schema.js";
import { systemImageService } from "../services/system-image-service.js";
import {
  contentTypeForExtension,
  isSafeFilename,
  MAX_FILE_SIZE,
  validateImageUpload,
} from "../lib/upload-validation.js";
import { badRequest, notFound, payloadTooLarge } from "../lib/errors.js";
import { sendSuccess } from "../lib/http.js";
import { parseParams } from "../lib/validation.js";
import {
  readStoredImage,
  storedImageExists,
  type StoredImageResult,
} from "../helpers/imageServing.js";

function sendImageHeaders(reply: FastifyReply, contentType: string): void {
  reply.headers({
    "Content-Type": contentType,
    "Cache-Control": "private, max-age=3600",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'",
  });
}

function sendStoredImage(reply: FastifyReply, image: StoredImageResult) {
  sendImageHeaders(reply, image.contentType);
  return reply.send(image.buffer);
}

export async function getVisitorImage(
  req: FastifyRequest,
  reply: FastifyReply
) {
  const { filename } = parseParams(imageFilenameParamsSchema, req.params);
  if (!isSafeFilename(filename)) throw badRequest("Nome de arquivo inválido");

  const image = readStoredImage("visitors", filename);
  if (!image) throw notFound("Imagem não encontrada");
  return sendStoredImage(reply, image);
}

export async function checkVisitorImageExists(
  req: FastifyRequest,
  reply: FastifyReply
) {
  const { filename } = parseParams(imageFilenameParamsSchema, req.params);
  if (!isSafeFilename(filename)) throw badRequest("Nome de arquivo inválido");

  if (!storedImageExists("visitors", filename)) {
    return reply.status(404).send({ exists: false });
  }
  return sendSuccess(reply, { exists: true });
}

export async function getPermissionarioImage(
  req: FastifyRequest,
  reply: FastifyReply
) {
  const { filename } = parseParams(imageFilenameParamsSchema, req.params);
  if (!isSafeFilename(filename)) throw badRequest("Nome de arquivo inválido");

  const image = readStoredImage("permissionarios", filename);
  if (!image) throw notFound("Imagem não encontrada");
  return sendStoredImage(reply, image);
}

async function readUpload(req: FastifyRequest): Promise<{
  buffer: Buffer;
  extension: string;
}> {
  const data = await req.file();
  const validation = validateImageUpload(
    data
      ? { filename: data.filename, mimetype: data.mimetype, size: 0 }
      : undefined
  );
  if (validation.ok === false) throw badRequest(validation.reason);

  const buffer = await data.toBuffer();
  if (buffer.length > MAX_FILE_SIZE) {
    throw payloadTooLarge("Arquivo excede o limite de 5MB");
  }

  return { buffer, extension: validation.extension };
}

export async function uploadLogo(req: FastifyRequest, reply: FastifyReply) {
  const { buffer, extension } = await readUpload(req);
  const image = await systemImageService.upload("logo", buffer, extension);
  return sendSuccess(reply, {
    success: true,
    fileName: image.filename,
    imagePath: image.url,
    message: "Logo atualizada com sucesso",
  });
}

export async function uploadBackground(
  req: FastifyRequest,
  reply: FastifyReply
) {
  const { buffer, extension } = await readUpload(req);
  const image = await systemImageService.upload(
    "background",
    buffer,
    extension
  );
  return sendSuccess(reply, {
    success: true,
    fileName: image.filename,
    imagePath: image.url,
    message: "Background atualizado com sucesso",
  });
}

export async function getCurrentSystemImages(
  _req: FastifyRequest,
  reply: FastifyReply
) {
  return sendSuccess(reply, await systemImageService.getCurrent());
}

export async function resetSystemImage(
  req: FastifyRequest,
  reply: FastifyReply
) {
  const { type } = parseParams(systemImageTypeParamsSchema, req.params);
  const filesDeleted = await systemImageService.reset(type);
  return sendSuccess(reply, {
    success: true,
    message: `Imagem ${type} restaurada para padrão`,
    filesDeleted,
  });
}

export async function getSystemImage(
  req: FastifyRequest,
  reply: FastifyReply
) {
  const { filename } = parseParams(imageFilenameParamsSchema, req.params);
  if (!isSafeFilename(filename)) throw badRequest("Nome de arquivo inválido");

  const buffer = await systemImageService.read(filename);
  if (!buffer) throw notFound("Imagem não encontrada");

  const ext = path.extname(filename).toLowerCase();
  reply.headers({
    "Content-Type": contentTypeForExtension(ext),
    "Cache-Control": "public, max-age=86400",
    "X-Content-Type-Options": "nosniff",
  });
  return reply.send(buffer);
}