import { describe, expect, it, vi } from "vitest";

vi.mock("../../lib/prisma.js", () => ({ prisma: {} }));

import { planValue } from "../../scripts/normalize-documents.js";

describe("normalize-documents planValue", () => {
  it("ignores empty and already-normalized values", () => {
    expect(planValue("cpf", 1, "idNumber", "")).toBeNull();
    expect(planValue("cpf", 1, "idNumber", null)).toBeNull();
    expect(planValue("cpf", 1, "idNumber", "52998224725")).toBeNull();
  });

  it("normalizes a masked valid CPF", () => {
    expect(planValue("cpf", 1, "idNumber", "529.982.247-25")).toEqual({
      id: 1,
      field: "idNumber",
      from: "529.982.247-25",
      to: "52998224725",
    });
  });

  it("reports invalid values without a target", () => {
    expect(planValue("cpf", 2, "idNumber", "N/A")).toEqual({ id: 2, field: "idNumber", from: "N/A" });
    expect(planValue("cpf", 3, "idNumber", "529.982.247-26")).toEqual({
      id: 3,
      field: "idNumber",
      from: "529.982.247-26",
    });
  });

  it("handles CNH", () => {
    expect(planValue("cnh", 4, "driverLicense", "0123 4567 890")?.to).toBe("01234567890");
    expect(planValue("cnh", 5, "driverLicense", "123")?.to).toBeUndefined();
  });
});
