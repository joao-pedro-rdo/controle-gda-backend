import { describe, expect, it } from "vitest";

import {
  createVehicleSchema,
  isValidPlate,
  updateVehicleSchema,
  vehicleIdParamsSchema,
} from "../../schemas/vehicles-schema.js";

const validBody = {
  completeName: "João da Silva",
  tagName: "Cap Silva",
  carModel: "Gol",
  licensePlate: "ABC1D23",
  color: "Prata",
  driverLicense: "12345678901",
  idNumber: "529.982.247-25",
  company: "1º Esqd",
  section: "CIA MANUT",
};

describe("vehicles schemas", () => {
  it("parses a valid create payload and normalizes the plate", () => {
    const result = createVehicleSchema.parse({ ...validBody, licensePlate: "abc-1d23" });

    expect(result).toMatchObject({ licensePlate: "ABC1D23" });
    expect(result).toMatchObject({ idNumber: "529.982.247-25" });
  });

  it("defaults optional fields to empty string on create", () => {
    const minimal = {
      completeName: "A",
      tagName: "B",
      carModel: "C",
      licensePlate: "ABC1234",
      color: "D",
      idNumber: "111.444.777-35",
    };

    expect(createVehicleSchema.parse(minimal)).toMatchObject({
      driverLicense: "",
      company: "",
      section: "",
    });
  });

  it("rejects create without required fields", () => {
    const result = createVehicleSchema.safeParse({ completeName: "Só nome" });

    expect(result.success).toBe(false);
  });

  it("rejects create with an invalid plate", () => {
    const result = createVehicleSchema.safeParse({
      ...validBody,
      licensePlate: "ABC-1D2",
    });

    expect(result.success).toBe(false);
  });

  it("rejects create with an invalid CPF", () => {
    const result = createVehicleSchema.safeParse({
      ...validBody,
      idNumber: "123.456.789-00",
    });

    expect(result.success).toBe(false);
  });

  it("rejects update with an empty body", () => {
    const result = updateVehicleSchema.safeParse({});

    expect(result.success).toBe(false);
  });

  it("parses a partial update", () => {
    expect(updateVehicleSchema.parse({ color: "Vermelho" })).toEqual({
      color: "Vermelho",
    });
  });

  it("coerces id params", () => {
    expect(vehicleIdParamsSchema.parse({ id: "42" })).toEqual({ id: 42 });
  });

  it("validates Mercosul and legacy plates", () => {
    expect(isValidPlate("ABC1D23")).toBe(true);
    expect(isValidPlate("ABC-1234")).toBe(true);
    expect(isValidPlate("ABC1234")).toBe(true);
    expect(isValidPlate("ABC1D")).toBe(false);
  });
});
