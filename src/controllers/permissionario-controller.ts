import type { FastifyReply, FastifyRequest } from "fastify";

import {
  createPermissionarioSchema,
  permissionarioCpfParamsSchema,
  permissionarioIdParamsSchema,
  updatePermissionarioSchema,
} from "../schemas/permissionario-schema.js";
import { permissionarioService } from "../services/permissionario-service.js";
import { sendSuccess } from "../lib/http.js";
import { readMultipartForm } from "../lib/multipart.js";
import { parseBody, parseParams } from "../lib/validation.js";

export async function index(req: FastifyRequest, reply: FastifyReply) {
  return sendSuccess(reply, await permissionarioService.list());
}

export async function getById(req: FastifyRequest, reply: FastifyReply) {
  const { id } = parseParams(permissionarioIdParamsSchema, req.params);
  return sendSuccess(reply, await permissionarioService.getById(id));
}

export async function getByCpf(req: FastifyRequest, reply: FastifyReply) {
  const { cpf } = parseParams(permissionarioCpfParamsSchema, req.params);
  return sendSuccess(reply, await permissionarioService.getByCpf(cpf));
}

export async function create(req: FastifyRequest, reply: FastifyReply) {
  const { form, image } = await readMultipartForm(req);
  const body = parseBody(createPermissionarioSchema, form);
  const permissionario = await permissionarioService.create(body, { image });
  return sendSuccess(reply, permissionario, 201);
}

export async function update(req: FastifyRequest, reply: FastifyReply) {
  const { id } = parseParams(permissionarioIdParamsSchema, req.params);
  const { form, image } = await readMultipartForm(req);
  const body = parseBody(updatePermissionarioSchema, form);
  const removeImage = form.removeImage === "true";
  const permissionario = await permissionarioService.update(id, body, {
    image,
    removeImage,
  });
  return sendSuccess(reply, permissionario);
}

export async function remove(req: FastifyRequest, reply: FastifyReply) {
  const { id } = parseParams(permissionarioIdParamsSchema, req.params);
  return sendSuccess(reply, await permissionarioService.remove(id));
}
