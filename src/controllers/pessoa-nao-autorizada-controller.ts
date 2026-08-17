import type { FastifyReply, FastifyRequest } from "fastify";

import {
  createPessoaNaoAutorizadaSchema,
  pessoaNaoAutorizadaIdParamsSchema,
  updatePessoaNaoAutorizadaSchema,
} from "../schemas/pessoa-nao-autorizada-schema.js";
import { pessoaNaoAutorizadaService } from "../services/pessoa-nao-autorizada-service.js";
import { sendSuccess } from "../lib/http.js";
import { readMultipartForm } from "../lib/multipart.js";
import { parseBody, parseParams } from "../lib/validation.js";
import { badRequest, notFound } from "../lib/errors.js";
import { isSafeFilename } from "../lib/upload-validation.js";
import { readStoredImage } from "../helpers/imageServing.js";

export async function index(req: FastifyRequest, reply: FastifyReply) {
  return sendSuccess(reply, await pessoaNaoAutorizadaService.list());
}

export async function getById(req: FastifyRequest, reply: FastifyReply) {
  const { id } = parseParams(pessoaNaoAutorizadaIdParamsSchema, req.params);
  return sendSuccess(reply, await pessoaNaoAutorizadaService.getById(id));
}

export async function create(req: FastifyRequest, reply: FastifyReply) {
  const { form, image } = await readMultipartForm(req);
  const body = parseBody(createPessoaNaoAutorizadaSchema, form);
  const pessoa = await pessoaNaoAutorizadaService.create(body, { image });
  return sendSuccess(
    reply,
    { message: "Pessoa não autorizada cadastrada com sucesso", pessoa },
    201
  );
}

export async function update(req: FastifyRequest, reply: FastifyReply) {
  const { id } = parseParams(pessoaNaoAutorizadaIdParamsSchema, req.params);
  const { form, image } = await readMultipartForm(req);
  const body = parseBody(updatePessoaNaoAutorizadaSchema, form);
  const pessoa = await pessoaNaoAutorizadaService.update(id, body, { image });
  return sendSuccess(reply, {
    message: "Pessoa não autorizada atualizada com sucesso",
    pessoa,
  });
}

export async function remove(req: FastifyRequest, reply: FastifyReply) {
  const { id } = parseParams(pessoaNaoAutorizadaIdParamsSchema, req.params);
  await pessoaNaoAutorizadaService.remove(id);
  return sendSuccess(reply, {
    message: "Pessoa não autorizada removida com sucesso",
    id,
  });
}

export async function getImage(req: FastifyRequest, reply: FastifyReply) {
  const { filename } = req.params as { filename?: string };

  if (!filename || !isSafeFilename(filename)) {
    throw badRequest("Nome de arquivo inválido");
  }

  const image = readStoredImage("pessoas-nao-autorizadas", filename);
  if (!image) throw notFound("Imagem não encontrada");

  reply.headers({
    "Content-Type": image.contentType,
    "Cache-Control": "private, max-age=3600",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'",
  });

  return reply.send(image.buffer);
}