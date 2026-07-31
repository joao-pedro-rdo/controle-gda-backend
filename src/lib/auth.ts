import type { FastifyReply, FastifyRequest } from "fastify";
import jwt from "jsonwebtoken";

import { forbidden, internal, unauthorized } from "./errors.js";
import { prisma } from "./prisma.js";

export interface AuthUser {
  id: number;
  login: string;
  role: string;
}

export interface AuthTokenPayload {
  id: number;
  login: string;
  role: string;
}

export const AUTH_COOKIE_NAME = "accessToken";

const COOKIE_MAX_AGE = 8 * 60 * 60 * 1000; // 8 horas

export function getJwtSecret(): string {
  if (!process.env.JWT_SECRET) {
    throw internal("Erro de configuração do servidor");
  }
  return process.env.JWT_SECRET;
}

export function extractAccessToken(request: FastifyRequest): string | null {
  const cookieToken = request.cookies?.[AUTH_COOKIE_NAME];
  if (cookieToken) return cookieToken;

  const authHeader = request.headers.authorization;
  if (!authHeader) return null;

  if (authHeader.startsWith("Bearer ")) return authHeader.slice(7);
  return authHeader;
}

export function verifyAccessToken(token: string): AuthTokenPayload {
  const secret = getJwtSecret();
  try {
    return jwt.verify(token, secret) as AuthTokenPayload;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      (error as { name?: unknown }).name === "TokenExpiredError"
    ) {
      throw unauthorized("Sessão expirada");
    }
    throw unauthorized("Sessão inválida");
  }
}

export async function findAuthUser(id: number): Promise<AuthUser | null> {
  return prisma.user.findUnique({
    where: { id },
    select: { id: true, login: true, role: true },
  });
}

export async function requireAuth(request: FastifyRequest): Promise<AuthUser> {
  const token = extractAccessToken(request);
  if (!token) throw unauthorized("Token de acesso não fornecido");

  const payload = verifyAccessToken(token);
  const user = await findAuthUser(payload.id);
  if (!user) throw unauthorized("Usuário não encontrado");

  return user;
}

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  request.user = await requireAuth(request);
}

export function requireRoles(...allowedRoles: string[]) {
  return async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    const user = await requireAuth(request);
    request.user = user;

    if (!allowedRoles.includes(user.role)) {
      throw forbidden(
        `Acesso negado. Apenas usuários ${allowedRoles.join(" ou ")} podem acessar este recurso.`
      );
    }
  };
}

export const requireS2Role = requireRoles("S2");
export const requireGuardaRole = requireRoles("Guarda", "S2", "Scmt");

export function setAuthCookie(reply: FastifyReply, token: string): void {
  reply.setCookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
}

export function clearAuthCookie(reply: FastifyReply): void {
  reply.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
}
