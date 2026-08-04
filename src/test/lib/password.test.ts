import { describe, expect, it } from "vitest";

import { comparePassword, hashPassword } from "../../lib/password.js";

describe("password helpers", () => {
  it("hashes and compares a valid password", async () => {
    const hashed = await hashPassword("teste123");

    expect(hashed).not.toBe("teste123");
    await expect(comparePassword("teste123", hashed)).resolves.toBe(true);
    await expect(comparePassword("senha-errada", hashed)).resolves.toBe(false);
  });
});
