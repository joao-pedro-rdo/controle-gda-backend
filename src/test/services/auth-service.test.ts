import { describe, expect, it } from "vitest";

import { verifyAccessToken } from "../../lib/auth.js";
import { AppError } from "../../lib/errors.js";
import { comparePassword, hashPassword } from "../../lib/password.js";
import type {
  PublicUser,
  UserRepository,
  UserWithPassword,
} from "../../repositories/user-repository.js";
import { createAuthService } from "../../services/auth-service.js";

function toPublicUser(user: UserWithPassword): PublicUser {
  return { id: user.id, login: user.login, role: user.role };
}

function createFakeRepository(users: UserWithPassword[]): UserRepository {
  return {
    async findMany() {
      return users.map(toPublicUser);
    },
    async findByLogin(login) {
      return users.find((user) => user.login === login) ?? null;
    },
    async findById(id) {
      const user = users.find((item) => item.id === id);
      return user ? toPublicUser(user) : null;
    },
    async create(data) {
      if (users.some((user) => user.login === data.login)) {
        throw { code: "P2002" };
      }

      const user = { id: users.length + 1, ...data };
      users.push(user);
      return toPublicUser(user);
    },
    async update(id, data) {
      const user = users.find((item) => item.id === id);
      if (!user) throw { code: "P2025" };

      Object.assign(user, data);
      return toPublicUser(user);
    },
    async delete(id) {
      const index = users.findIndex((item) => item.id === id);
      if (index === -1) throw { code: "P2025" };

      const [user] = users.splice(index, 1);
      return toPublicUser(user);
    },
  };
}

describe("auth service", () => {
  it("logs in with valid credentials and returns a signed token", async () => {
    const users = [
      {
        id: 1,
        login: "s2",
        password: await hashPassword("teste123"),
        role: "S2",
      },
    ];
    const service = createAuthService(createFakeRepository(users));

    const result = await service.login({ login: "s2", password: "teste123" });

    expect(result.user).toEqual({ id: 1, login: "s2", role: "S2" });
    expect(verifyAccessToken(result.token)).toMatchObject({ id: 1, login: "s2" });
  });

  it("rejects invalid login credentials", async () => {
    const users = [
      {
        id: 1,
        login: "s2",
        password: await hashPassword("teste123"),
        role: "S2",
      },
    ];
    const service = createAuthService(createFakeRepository(users));

    await expect(
      service.login({ login: "s2", password: "errada" })
    ).rejects.toMatchObject({ statusCode: 401, code: "UNAUTHORIZED" });
  });

  it("creates users with hashed passwords and without exposing the hash", async () => {
    const users: UserWithPassword[] = [];
    const service = createAuthService(createFakeRepository(users));

    const created = await service.signup({
      login: "guarda",
      password: "teste123",
      role: "Guarda",
    });

    expect(created).toEqual({ id: 1, login: "guarda", role: "Guarda" });
    expect(users[0].password).not.toBe("teste123");
    await expect(comparePassword("teste123", users[0].password)).resolves.toBe(true);
  });

  it("rejects wrong old password when updating password", async () => {
    const users = [
      {
        id: 1,
        login: "s2",
        password: await hashPassword("teste123"),
        role: "S2",
      },
    ];
    const service = createAuthService(createFakeRepository(users));

    await expect(
      service.updatePassword(1, {
        login: "s2",
        oldPass: "errada",
        newPass: "nova123",
      }, 1)
    ).rejects.toBeInstanceOf(AppError);

    await expect(
      service.updatePassword(1, {
        login: "s2",
        oldPass: "errada",
        newPass: "nova123",
      }, 1)
    ).rejects.toMatchObject({ statusCode: 400, code: "BAD_REQUEST" });
  });
});
