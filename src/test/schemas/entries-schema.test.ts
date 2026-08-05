import { describe, expect, it } from "vitest";

import {
  createEntrySchema,
  createExitSchema,
  createScheduledEntrySchema,
  dateRangeQuerySchema,
  entryIdParamsSchema,
} from "../../schemas/entries-schema.js";

describe("entries schemas", () => {
  describe("createEntrySchema", () => {
    const validForm = {
      type: "Entrada",
      isVisitor: "true",
      isPermissionario: "false",
      name: "Maria Souza",
      idNumber: "123456",
    };

    it("parses multipart string fields into typed booleans", () => {
      const result = createEntrySchema.safeParse(validForm);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isVisitor).toBe(true);
        expect(result.data.isPermissionario).toBe(false);
        expect(result.data.name).toBe("Maria Souza");
      }
    });

    it("rejects when name is missing", () => {
      const result = createEntrySchema.safeParse({ type: "Entrada" });
      expect(result.success).toBe(false);
    });

    it("rejects when isVisitor and isPermissionario are both true", () => {
      const result = createEntrySchema.safeParse({
        ...validForm,
        isVisitor: "true",
        isPermissionario: "true",
      });
      expect(result.success).toBe(false);
    });

    it("rejects an inconsistent scheduled exit type", () => {
      const result = createEntrySchema.safeParse({
        ...validForm,
        type: "Saída",
        isScheduled: "true",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("createExitSchema", () => {
    const validExit = {
      entryId: 5,
      name: "Maria Souza",
      isVisitor: true,
      isPermissionario: "false",
    };

    it("parses booleans given as strings or booleans", () => {
      const result = createExitSchema.safeParse(validExit);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.entryId).toBe(5);
        expect(result.data.isVisitor).toBe(true);
        expect(result.data.isPermissionario).toBe(false);
      }
    });

    it("rejects when entryId is missing or invalid", () => {
      expect(createExitSchema.safeParse({ name: "X" }).success).toBe(false);
      expect(
        createExitSchema.safeParse({ entryId: "abc", name: "X" }).success
      ).toBe(false);
    });
  });

  describe("createScheduledEntrySchema", () => {
    it("accepts a valid future date string", () => {
      const result = createScheduledEntrySchema.safeParse({
        name: "João",
        idNumber: "123",
        scheduledDate: "2027-01-01T10:00:00.000Z",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.scheduledDate).toBeInstanceOf(Date);
      }
    });

    it("rejects an invalid date string", () => {
      const result = createScheduledEntrySchema.safeParse({
        name: "João",
        idNumber: "123",
        scheduledDate: "not-a-date",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("dateRangeQuerySchema", () => {
    it("accepts a valid range", () => {
      const result = dateRangeQuerySchema.safeParse({
        initialDate: "2026-08-01T00:00:00.000Z",
        finalDate: "2026-08-02T00:00:00.000Z",
      });
      expect(result.success).toBe(true);
    });

    it("rejects when finalDate is not after initialDate", () => {
      const result = dateRangeQuerySchema.safeParse({
        initialDate: "2026-08-02T00:00:00.000Z",
        finalDate: "2026-08-01T00:00:00.000Z",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("entryIdParamsSchema", () => {
    it("coerces a numeric id from params", () => {
      const result = entryIdParamsSchema.safeParse({ id: "42" });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.id).toBe(42);
    });
  });
});
