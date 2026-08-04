import { describe, expect, it } from "vitest";

import {
  loginSchema,
  signupSchema,
  updatePasswordSchema,
  updateUserSchema,
  userIdParamsSchema,
} from "../../schemas/auth-schema.js";

describe("auth schemas", () => {
  it("parses a valid login payload", () => {
    expect(loginSchema.parse({ login: " s2 ", password: "teste123" })).toEqual({
      login: "s2",
      password: "teste123",
    });
  });

  it("rejects login without password", () => {
    const result = loginSchema.safeParse({ login: "s2" });

    expect(result.success).toBe(false);
  });

  it("requires a strong enough signup password", () => {
    const result = signupSchema.safeParse({
      login: "guarda",
      password: "123",
      role: "Guarda",
    });

    expect(result.success).toBe(false);
  });

  it("requires at least one field for user updates", () => {
    const result = updateUserSchema.safeParse({});

    expect(result.success).toBe(false);
  });

  it("parses password update and coerces id params", () => {
    expect(
      updatePasswordSchema.parse({
        login: "s2",
        oldPass: "teste123",
        newPass: "nova123",
      })
    ).toEqual({ login: "s2", oldPass: "teste123", newPass: "nova123" });

    expect(userIdParamsSchema.parse({ id: "42" })).toEqual({ id: 42 });
  });
});
