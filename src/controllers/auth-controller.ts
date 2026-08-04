import type { FastifyReply, FastifyRequest } from "fastify";

import { authService } from "../services/auth-service.js";
import {
  loginSchema,
  signupSchema,
  updatePasswordSchema,
  updateUserSchema,
  userIdParamsSchema,
} from "../schemas/auth-schema.js";
import { setAuthCookie } from "../lib/auth.js";
import { unauthorized } from "../lib/errors.js";
import { sendSuccess } from "../lib/http.js";
import { parseBody, parseParams } from "../lib/validation.js";

export async function listUsers(req: FastifyRequest, reply: FastifyReply) {
  return sendSuccess(reply, await authService.listUsers());
}

export async function signup(req: FastifyRequest, reply: FastifyReply) {
  const body = parseBody(signupSchema, req.body);
  const user = await authService.signup(body);
  return sendSuccess(reply, user, 201);
}

export async function login(req: FastifyRequest, reply: FastifyReply) {
  const body = parseBody(loginSchema, req.body);
  const { user, token } = await authService.login(body);

  setAuthCookie(reply, token);

  return sendSuccess(reply, {
    message: "Login realizado com sucesso",
    user,
  });
}

export async function deleteUser(req: FastifyRequest, reply: FastifyReply) {
  const { id } = parseParams(userIdParamsSchema, req.params);
  const user = await authService.deleteUser(id);
  return sendSuccess(reply, user);
}

export async function updateUser(req: FastifyRequest, reply: FastifyReply) {
  const { id } = parseParams(userIdParamsSchema, req.params);
  const body = parseBody(updateUserSchema, req.body);
  const user = await authService.updateUser(id, body);
  return sendSuccess(reply, user);
}

export async function updPass(req: FastifyRequest, reply: FastifyReply) {
  const { id } = parseParams(userIdParamsSchema, req.params);
  const body = parseBody(updatePasswordSchema, req.body);

  if (!req.user) throw unauthorized("Usuário não autenticado");

  const user = await authService.updatePassword(id, body, req.user.id);
  return sendSuccess(reply, user);
}

export async function logout(req: FastifyRequest, reply: FastifyReply) {
  return sendSuccess(reply, authService.logout(reply));
}

export async function checkAuth(req: FastifyRequest, reply: FastifyReply) {
  if (!req.user) throw unauthorized("Usuário não autenticado");
  return sendSuccess(reply, authService.checkSession(req.user));
}
