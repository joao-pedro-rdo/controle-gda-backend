import { describe, expect, it, vi } from "vitest";

vi.mock("../../lib/prisma.js", () => ({ prisma: {} }));

import { markConflicts, normalizePlateValue, planValue } from "../../scripts/normalize-documents.js";

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
    expect(planValue("cpf", 2, "idNumber", "N/A")).toEqual({ id: 2, field: "idNumber", from: "N/A", reason: "inválido" });
    expect(planValue("cpf", 3, "idNumber", "529.982.247-26")).toEqual({
      id: 3,
      field: "idNumber",
      from: "529.982.247-26",
      reason: "inválido",
    });
  });

  it("handles CNH", () => {
    expect(planValue("cnh", 4, "driverLicense", "0123 4567 890")?.to).toBe("01234567890");
    expect(planValue("cnh", 5, "driverLicense", "123")?.to).toBeUndefined();
  });

  it("normalizes plates and keeps invalid ones", () => {
    expect(planValue("plate", 6, "licensePlate", "abc-1234")?.to).toBe("ABC1234");
    expect(planValue("plate", 7, "licensePlate", "BRA2E19")).toBeNull();
    expect(planValue("plate", 8, "licensePlate", "N/A")?.to).toBeUndefined();
  });

  it("does not normalize into a value another row already has", () => {
    const plans = [planValue("plate", 1, "licensePlate", "ABC-1234")!, planValue("plate", 3, "licensePlate", "xyz-9876")!];
    const rows = [
      { id: 1, value: "ABC-1234" },
      { id: 2, value: "ABC1234" },
      { id: 3, value: "xyz-9876" },
    ];
    const result = markConflicts(plans, rows, normalizePlateValue);
    expect(result[0].to).toBeUndefined();
    expect(result[0].reason).toContain("#2");
    expect(result[1].to).toBe("XYZ9876");
  });
});
