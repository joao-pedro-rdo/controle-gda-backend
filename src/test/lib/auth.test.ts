import type { FastifyReply, FastifyRequest } from "fastify";
import jwt from "jsonwebtoken";
import { describe, expect, it } from "vitest";

import {
  AUTH_COOKIE_NAME,
  extractAccessToken,
  setAuthCookie,
  verifyAccessToken,
} from "../../lib/auth.js";
import { AppError } from "../../lib/errors.js";

function signToken(payload: object): string {
  return jwt.sign(payload, process.env.JWT_SECRET as string);
}

describe("auth helpers", () => {
  describe("extractAccessToken", () => {
    it("reads the token from the cookie first", () => {
      const request = {
        cookies: { [AUTH_COOKIE_NAME]: "token-do-cookie" },
        headers: { authorization: "Bearer token-do-header" },
      } as unknown as FastifyRequest;

      expect(extractAccessToken(request)).toBe("token-do-cookie");
    });

    it("falls back to the Authorization header", () => {
      const request = {
        cookies: {},
        headers: { authorization: "Bearer token-do-header" },
      } as unknown as FastifyRequest;

      expect(extractAccessToken(request)).toBe("token-do-header");
    });

    it("returns null when there is no token", () => {
      const request = { cookies: {}, headers: {} } as unknown as FastifyRequest;

      expect(extractAccessToken(request)).toBeNull();
    });
  });

  describe("verifyAccessToken", () => {
    it("decodes a valid token", () => {
      const token = signToken({ id: 1, login: "s2", role: "S2" });

      const payload = verifyAccessToken(token);

      expect(payload.id).toBe(1);
      expect(payload.login).toBe("s2");
      expect(payload.role).toBe("S2");
    });

    it("throws a 401 UNAUTHORIZED AppError for invalid tokens", () => {
      expect(() => verifyAccessToken("token-invalido")).toThrow(AppError);

      try {
        verifyAccessToken("token-invalido");
        expect.unreachable();
      } catch (error) {
        expect(error.statusCode).toBe(401);
        expect(error.code).toBe("UNAUTHORIZED");
      }
    });
  });

  describe("setAuthCookie", () => {
    it("sets the accessToken cookie as httpOnly", () => {
      const calls: Array<{ name: string; value: string; options: object }> = [];

      const reply = {
        setCookie: (name: string, value: string, options: object) => {
          calls.push({ name, value, options });
        },
      } as unknown as FastifyReply;

      setAuthCookie(reply, "token-123");

      expect(calls[0].name).toBe(AUTH_COOKIE_NAME);
      expect(calls[0].value).toBe("token-123");
      expect(calls[0].options).toMatchObject({ httpOnly: true, path: "/" });
    });
  });
});
