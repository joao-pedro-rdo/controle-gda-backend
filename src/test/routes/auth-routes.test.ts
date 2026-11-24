import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const routeState = vi.hoisted(() => ({
  users: new Map<number, { id: number; login: string; password: string; role: string }>(),
  nextId: 1,
}));

vi.mock("../../repositories/user-repository.js", () => {
  const toPublicUser = (user: { id: number; login: string; role: string }) => ({
    id: user.id,
    login: user.login,
    role: user.role,
  });

  return {
    prismaUserRepository: {
      async findMany() {
        return Array.from(routeState.users.values()).map(toPublicUser);
      },
      async findByLogin(login: string) {
        return (
          Array.from(routeState.users.values()).find((user) => user.login === login) ??
          null
        );
      },
      async findById(id: number) {
        const user = routeState.users.get(id);
        return user ? toPublicUser(user) : null;
      },
      async create(data: { login: string; password: string; role: string }) {
        if (
          Array.from(routeState.users.values()).some((user) => user.login === data.login)
        ) {
          throw { code: "P2002" };
        }

        const user = { id: routeState.nextId++, ...data };
        routeState.users.set(user.id, user);
        return toPublicUser(user);
      },
      async update(id: number, data: { login?: string; password?: string; role?: string }) {
        const user = routeState.users.get(id);
        if (!user) throw { code: "P2025" };

        Object.assign(user, data);
        return toPublicUser(user);
      },
      async delete(id: number) {
        const user = routeState.users.get(id);
        if (!user) throw { code: "P2025" };

        routeState.users.delete(id);
        return toPublicUser(user);
      },
    },
  };
});

import { signAccessToken } from "../../lib/auth.js";
import { hashPassword } from "../../lib/password.js";
import { createTestApp } from "../helpers/create-test-app.js";

describe("auth routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    routeState.users.clear();
    routeState.nextId = 2;
    routeState.users.set(1, {
      id: 1,
      login: "s2",
      password: await hashPassword("teste123"),
      role: "S2",
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("logs in with valid credentials and sets the accessToken cookie", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/login",
      payload: { login: "s2", password: "teste123" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      message: "Login realizado com sucesso",
      user: { id: 1, login: "s2", role: "S2" },
    });
    expect(response.json().user.password).toBeUndefined();
    expect(response.cookies.some((cookie) => cookie.name === "accessToken")).toBe(true);
  });

  it("rejects invalid login credentials", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/login",
      payload: { login: "s2", password: "errada" },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({
      code: "UNAUTHORIZED",
      message: "Credenciais inválidas",
    });
  });

  it("rejects invalid login body", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/login",
      payload: { login: "s2" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe("VALIDATION_ERROR");
  });

  it("returns authenticated user on auth check with a valid cookie", async () => {
    const token = signAccessToken({ id: 1, login: "s2", role: "S2" });

    const response = await app.inject({
      method: "GET",
      url: "/auth/check",
      cookies: { accessToken: token },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      authenticated: true,
      user: { id: 1, login: "s2", role: "S2" },
    });
  });

  it("rejects auth check without cookie", async () => {
    const response = await app.inject({ method: "GET", url: "/auth/check" });

    expect(response.statusCode).toBe(401);
    expect(response.json().code).toBe("UNAUTHORIZED");
  });

  it("logs out by clearing the accessToken cookie", async () => {
    const response = await app.inject({ method: "POST", url: "/logout" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ message: "Logout realizado com sucesso" });
    expect(response.cookies.some((cookie) => cookie.name === "accessToken")).toBe(true);
  });

  describe("user management", () => {
    const s2Cookie = () => ({ accessToken: signAccessToken({ id: 1, login: "s2", role: "S2" }) });

    async function addGuarda() {
      routeState.users.set(2, {
        id: 2,
        login: "guarda",
        password: await hashPassword("teste123"),
        role: "Guarda",
      });
      routeState.nextId = 3;
      return { accessToken: signAccessToken({ id: 2, login: "guarda", role: "Guarda" }) };
    }

    it("lists users without exposing passwords (S2)", async () => {
      const response = await app.inject({ method: "GET", url: "/users", cookies: s2Cookie() });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual([{ id: 1, login: "s2", role: "S2" }]);
    });

    it("forbids listing users for Guarda (403)", async () => {
      const cookies = await addGuarda();
      const response = await app.inject({ method: "GET", url: "/users", cookies });

      expect(response.statusCode).toBe(403);
    });

    it("creates a user (201) and rejects a duplicated login (409)", async () => {
      const payload = { login: "novo", password: "segredo1", role: "SFPC" };

      const created = await app.inject({ method: "POST", url: "/signup", cookies: s2Cookie(), payload });
      expect(created.statusCode).toBe(201);
      expect(created.json()).toMatchObject({ login: "novo", role: "SFPC" });
      expect(created.json()).not.toHaveProperty("password");

      const duplicated = await app.inject({ method: "POST", url: "/signup", cookies: s2Cookie(), payload });
      expect(duplicated.statusCode).toBe(409);
    });

    it("rejects signup with a legacy role (400)", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/signup",
        cookies: s2Cookie(),
        payload: { login: "x", password: "segredo1", role: "Ofdia" },
      });

      expect(response.statusCode).toBe(400);
    });

    it("requires authentication to sign up (401)", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/signup",
        payload: { login: "x", password: "segredo1", role: "Guarda" },
      });

      expect(response.statusCode).toBe(401);
    });

    it("updates a user role (200) and returns 404 for unknown ids", async () => {
      await addGuarda();

      const updated = await app.inject({
        method: "PATCH",
        url: "/updateUser/2",
        cookies: s2Cookie(),
        payload: { role: "Scmt" },
      });
      expect(updated.statusCode).toBe(200);
      expect(updated.json()).toMatchObject({ id: 2, role: "Scmt" });

      const missing = await app.inject({
        method: "PATCH",
        url: "/updateUser/99",
        cookies: s2Cookie(),
        payload: { role: "Scmt" },
      });
      expect(missing.statusCode).toBe(404);
    });

    it("deletes a user (200) and returns 404 for unknown ids", async () => {
      await addGuarda();

      const deleted = await app.inject({ method: "DELETE", url: "/deleteUser/2", cookies: s2Cookie() });
      expect(deleted.statusCode).toBe(200);
      expect(routeState.users.has(2)).toBe(false);

      const missing = await app.inject({ method: "DELETE", url: "/deleteUser/2", cookies: s2Cookie() });
      expect(missing.statusCode).toBe(404);
    });
  });

  describe("password change", () => {
    it("changes the own password (200) and allows login with it", async () => {
      const cookies = { accessToken: signAccessToken({ id: 1, login: "s2", role: "S2" }) };
      const response = await app.inject({
        method: "PATCH",
        url: "/updPass/1",
        cookies,
        payload: { login: "s2", oldPass: "teste123", newPass: "novaSenha1" },
      });
      expect(response.statusCode).toBe(200);

      const login = await app.inject({
        method: "POST",
        url: "/login",
        payload: { login: "s2", password: "novaSenha1" },
      });
      expect(login.statusCode).toBe(200);
    });

    it("rejects a wrong old password (400)", async () => {
      const response = await app.inject({
        method: "PATCH",
        url: "/updPass/1",
        cookies: { accessToken: signAccessToken({ id: 1, login: "s2", role: "S2" }) },
        payload: { login: "s2", oldPass: "errada", newPass: "novaSenha1" },
      });

      expect(response.statusCode).toBe(400);
    });

    it("forbids changing another user's password (403)", async () => {
      routeState.users.set(2, { id: 2, login: "guarda", password: "x", role: "Guarda" });
      const response = await app.inject({
        method: "PATCH",
        url: "/updPass/1",
        cookies: { accessToken: signAccessToken({ id: 2, login: "guarda", role: "Guarda" }) },
        payload: { login: "s2", oldPass: "teste123", newPass: "novaSenha1" },
      });

      expect(response.statusCode).toBe(403);
    });

    it("requires authentication (401)", async () => {
      const response = await app.inject({
        method: "PATCH",
        url: "/updPass/1",
        payload: { login: "s2", oldPass: "teste123", newPass: "novaSenha1" },
      });

      expect(response.statusCode).toBe(401);
    });
  });
});
