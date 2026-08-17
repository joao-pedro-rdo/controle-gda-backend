import type { FastifyReply, FastifyRequest } from "fastify";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import {
  createPessoaNaoAutorizadaSchema,
  pessoaNaoAutorizadaIdParamsSchema,
  updatePessoaNaoAutorizadaSchema,
} from "../schemas/pessoa-nao-autorizada-schema.js";
import { pessoaNaoAutorizadaService } from "../services/pessoa-nao-autorizada-service.js";
import { sendSuccess } from "../lib/http.js";
import { readMultipartForm } from "../lib/multipart.js";
import { parseBody, parseParams } from "../lib/validation.js";
import { decryptImage } from "../helpers/imageEncryption.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pessoasNaoAutorizadasDir = path.join(
  __dirname,
  "../../uploads/pessoas-nao-autorizadas"
);

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

  if (!filename || filename.includes("..") || filename.includes("/")) {
    return reply.status(400).send({ error: "Nome de arquivo inválido" });
  }

  const encryptedPath = path.join(pessoasNaoAutorizadasDir, filename);
  const originalPath = path.join(
    pessoasNaoAutorizadasDir,
    filename.replace(/\.encrypted$/, "")
  );

  let imagePath: string;
  let isEncrypted = false;

  if (fs.existsSync(encryptedPath) && filename.endsWith(".encrypted")) {
    imagePath = encryptedPath;
    isEncrypted = true;
  } else if (fs.existsSync(originalPath)) {
    imagePath = originalPath;
    isEncrypted = false;
  } else {
    return reply.status(404).send({ error: "Imagem não encontrada" });
  }

  let imageBuffer: Buffer;
  let contentType = "image/jpeg";

  if (isEncrypted) {
    imageBuffer = decryptImage(imagePath);
    if (imageBuffer[0] === 0xff && imageBuffer[1] === 0xd8) {
      contentType = "image/jpeg";
    } else if (imageBuffer[0] === 0x89 && imageBuffer[1] === 0x50) {
      contentType = "image/png";
    }
  } else {
    imageBuffer = fs.readFileSync(imagePath);
  }

  reply.headers({
    "Content-Type": contentType,
    "Cache-Control": "private, max-age=3600",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'",
  });

  return reply.send(imageBuffer);
}