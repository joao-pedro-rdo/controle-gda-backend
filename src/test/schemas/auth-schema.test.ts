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

  it("accepts only current roles on signup", () => {
    for (const role of ["S2", "Guarda", "Scmt", "SFPC"]) {
      expect(
        signupSchema.safeParse({ login: "user", password: "teste123", role }).success
      ).toBe(true);
    }

    for (const role of ["Ofdia", "RP", "Sta", "Fiscal", ""]) {
      expect(
        signupSchema.safeParse({ login: "user", password: "teste123", role }).success
      ).toBe(false);
    }
  });

  it("rejects legacy roles on user update", () => {
    expect(updateUserSchema.safeParse({ role: "Ofdia" }).success).toBe(false);
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
