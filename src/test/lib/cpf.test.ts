import { describe, expect, it } from "vitest";

import { digitsOnly, isValidCpf } from "../../lib/cpf.js";

describe("isValidCpf", () => {
  it("accepts a known valid CPF", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
  });

  it("accepts a valid CPF without formatting", () => {
    expect(isValidCpf("52998224725")).toBe(true);
  });

  it("rejects an invalid check digit", () => {
    expect(isValidCpf("529.982.247-24")).toBe(false);
  });

  it("rejects repeated-digit CPFs", () => {
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(isValidCpf("000.000.000-00")).toBe(false);
  });

  it("rejects values with the wrong length", () => {
    expect(isValidCpf("123")).toBe(false);
    expect(isValidCpf("123.456.789")).toBe(false);
  });

  it("rejects non-numeric values", () => {
    expect(isValidCpf("abc.def.ghi-jk")).toBe(false);
  });

  it("strips formatting with digitsOnly", () => {
    expect(digitsOnly("529.982.247-25")).toBe("52998224725");
  });
});
