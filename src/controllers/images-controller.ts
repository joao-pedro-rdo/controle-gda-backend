import type { FastifyReply, FastifyRequest } from "fastify";

import { imageFilenameParamsSchema } from "../schemas/images-schema.js";
import { isSafeFilename } from "../lib/upload-validation.js";
import { badRequest, notFound } from "../lib/errors.js";
import { sendSuccess } from "../lib/http.js";
import { parseParams } from "../lib/validation.js";
import {
  readStoredImage,
  sendStoredImage,
  storedImageExists,
} from "../helpers/imageServing.js";

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
    throw notFound("Imagem não encontrada");
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
