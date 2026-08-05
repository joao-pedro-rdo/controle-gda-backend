import { z } from "zod";

import { isValidCpf } from "../lib/cpf.js";

const requiredString = z.string().trim().min(1, "Campo obrigatório");

function requiredField(field: string, max: number) {
  return requiredString.max(max, `${field} deve ter no máximo ${max} caracteres`);
}

function optionalField(max: number) {
  return z
    .string()
    .trim()
    .max(max, `Campo deve ter no máximo ${max} caracteres`)
    .optional();
}

function optionalDefaultedField(max: number) {
  return z
    .string()
    .trim()
    .max(max, `Campo deve ter no máximo ${max} caracteres`)
    .optional()
    .default("");
}

export function isValidPlate(value: string): boolean {
  const normalized = value.replace(/[\s.-]/g, "").toUpperCase();
  return (
    /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(normalized) || // padrão Mercosul (ABC1D23)
    /^[A-Z]{3}[0-9]{4}$/.test(normalized) // padrão antigo (ABC1234)
  );
}

export const plateSchema = z
  .string()
  .trim()
  .min(1, "Placa obrigatória")
  .max(10, "Placa deve ter no máximo 10 caracteres")
  .refine(isValidPlate, "Placa inválida")
  .transform((value) => value.replace(/[\s.-]/g, "").toUpperCase());

const cpfField = z
  .string()
  .trim()
  .min(1, "CPF obrigatório")
  .refine(isValidCpf, "CPF inválido");

export const createVehicleSchema = z.object({
  completeName: requiredField("Nome completo", 150),
  tagName: requiredField("P/G - Nome de guerra", 100),
  carModel: requiredField("Modelo", 50),
  licensePlate: plateSchema,
  color: requiredField("Cor", 20),
  driverLicense: optionalDefaultedField(30),
  idNumber: cpfField,
  company: optionalDefaultedField(10),
  section: optionalDefaultedField(50),
});

export const updateVehicleSchema = z
  .object({
    completeName: requiredField("Nome completo", 150).optional(),
    tagName: requiredField("P/G - Nome de guerra", 100).optional(),
    carModel: requiredField("Modelo", 50).optional(),
    licensePlate: plateSchema.optional(),
    color: requiredField("Cor", 20).optional(),
    driverLicense: optionalField(30),
    idNumber: cpfField.optional(),
    company: optionalField(10),
    section: optionalField(50),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Informe ao menos um campo para atualizar",
  });

export const vehicleIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const vehiclePlateParamsSchema = z.object({
  licensePlate: z
    .string()
    .trim()
    .min(1, "Placa obrigatória")
    .max(10, "Placa deve ter no máximo 10 caracteres")
    .transform((value) => value.replace(/[\s.-]/g, "").toUpperCase()),
});

export type CreateVehicleInput = z.infer<typeof createVehicleSchema>;
export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;
