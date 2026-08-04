import type { FastifyReply } from "fastify";

import { incrementLoginAttempts } from "../helpers/prometheus.js";
import {
  clearAuthCookie,
  signAccessToken,
  type AuthTokenPayload,
} from "../lib/auth.js";
import {
  badRequest,
  conflict,
  forbidden,
  notFound,
  unauthorized,
} from "../lib/errors.js";
import { comparePassword, hashPassword } from "../lib/password.js";
import {
  prismaUserRepository,
  type PublicUser,
  type UserRepository,
  type UserWithPassword,
} from "../repositories/user-repository.js";
import type {
  LoginInput,
  SignupInput,
  UpdatePasswordInput,
  UpdateUserInput,
} from "../schemas/auth-schema.js";

function toPublicUser(user: UserWithPassword | PublicUser): PublicUser {
  return { id: user.id, login: user.login, role: user.role };
}

function hasPrismaCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === code
  );
}

export function createAuthService(repository: UserRepository = prismaUserRepository) {
  return {
    listUsers(): Promise<PublicUser[]> {
      return repository.findMany();
    },

    async login(input: LoginInput): Promise<{ user: PublicUser; token: string }> {
      const user = await repository.findByLogin(input.login);
      if (!user) {
        incrementLoginAttempts("failed", null);
        throw unauthorized("Credenciais inválidas");
      }

      const validPassword = await comparePassword(input.password, user.password);
      if (!validPassword) {
        incrementLoginAttempts("failed", user.role);
        throw unauthorized("Credenciais inválidas");
      }

      const payload: AuthTokenPayload = {
        id: user.id,
        login: user.login,
        role: user.role,
      };
      const token = signAccessToken(payload);
      incrementLoginAttempts("success", user.role);

      return { user: toPublicUser(user), token };
    },

    async signup(input: SignupInput): Promise<PublicUser> {
      const password = await hashPassword(input.password);

      try {
        return await repository.create({
          login: input.login,
          password,
          role: input.role,
        });
      } catch (error) {
        if (hasPrismaCode(error, "P2002")) throw conflict("Usuário já existe");
        throw error;
      }
    },

    async updateUser(id: number, input: UpdateUserInput): Promise<PublicUser> {
      const password = input.password
        ? await hashPassword(input.password)
        : undefined;

      try {
        return await repository.update(id, {
          ...(input.login ? { login: input.login } : {}),
          ...(input.role ? { role: input.role } : {}),
          ...(password ? { password } : {}),
        });
      } catch (error) {
        if (hasPrismaCode(error, "P2025")) throw notFound("Usuário não encontrado");
        if (hasPrismaCode(error, "P2002")) throw conflict("Login já cadastrado");
        throw error;
      }
    },

    async updatePassword(
      id: number,
      input: UpdatePasswordInput,
      authenticatedUserId: number
    ): Promise<PublicUser> {
      if (authenticatedUserId !== id) {
        throw forbidden("Usuário só pode alterar a própria senha");
      }

      const user = await repository.findByLogin(input.login);
      if (!user || user.id !== id) throw notFound("Usuário não encontrado");

      const validPassword = await comparePassword(input.oldPass, user.password);
      if (!validPassword) throw badRequest("Senha antiga não confere");

      const password = await hashPassword(input.newPass);
      return repository.update(id, { password });
    },

    checkSession(user: PublicUser): { authenticated: true; user: PublicUser } {
      return { authenticated: true, user: toPublicUser(user) };
    },

    logout(reply: FastifyReply): { message: string } {
      clearAuthCookie(reply);
      return { message: "Logout realizado com sucesso" };
    },

    async deleteUser(id: number): Promise<PublicUser> {
      try {
        return await repository.delete(id);
      } catch (error) {
        if (hasPrismaCode(error, "P2025")) throw notFound("Usuário não encontrado");
        throw error;
      }
    },
  };
}

export const authService = createAuthService();
