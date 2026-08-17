import { z } from "zod";

import { digitsOnly, isValidCpf } from "../lib/cpf.js";

const requiredString = z.string().trim().min(1, "Campo obrigatório");

function requiredField(field: string, max: number) {
  return requiredString.max(max, `${field} deve ter no máximo ${max} caracteres`);
}

function nullableField(max: number) {
  return z
    .string()
    .trim()
    .max(max, `Campo deve ter no máximo ${max} caracteres`)
    .optional()
    .transform((value) =>
      value === undefined || value === "" ? null : value
    );
}

const cpfField = z
  .string()
  .trim()
  .min(1, "CPF obrigatório")
  .refine(isValidCpf, "CPF inválido")
  .transform((value) => digitsOnly(value));

const optionalPlate = z
  .string()
  .trim()
  .max(10, "Placa deve ter no máximo 10 caracteres")
  .optional()
  .transform((value) => {
    if (value === undefined || value === "") return null;
    return value.replace(/[\s.-]/g, "").toUpperCase();
  });

function nullableUpdateField(max: number) {
  return z
    .string()
    .trim()
    .max(max, `Campo deve ter no máximo ${max} caracteres`)
    .optional()
    .transform((value) => {
      if (value === undefined) return undefined;
      return value === "" ? null : value;
    });
}

const optionalPlateUpdate = z
  .string()
  .trim()
  .max(10, "Placa deve ter no máximo 10 caracteres")
  .optional()
  .transform((value) => {
    if (value === undefined) return undefined;
    if (value === "") return null;
    return value.replace(/[\s.-]/g, "").toUpperCase();
  });

export const createPermissionarioSchema = z.object({
  completeName: requiredField("Nome completo", 150),
  idNumber: requiredField("Identidade", 30),
  CPF: cpfField,
  local: nullableField(100),
  carModel: nullableField(50),
  licensePlate: optionalPlate,
  color: nullableField(20),
});

export const updatePermissionarioSchema = z
  .object({
    completeName: requiredField("Nome completo", 150).optional(),
    idNumber: requiredField("Identidade", 30).optional(),
    CPF: cpfField.optional(),
    local: nullableUpdateField(100),
    carModel: nullableUpdateField(50),
    licensePlate: optionalPlateUpdate,
    color: nullableUpdateField(20),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Informe ao menos um campo para atualizar",
  });

export const permissionarioIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const permissionarioCpfParamsSchema = z.object({
  cpf: z
    .string()
    .trim()
    .min(1, "CPF obrigatório")
    .transform((value) => digitsOnly(value)),
});

export type CreatePermissionarioInput = z.infer<
  typeof createPermissionarioSchema
>;
export type UpdatePermissionarioInput = z.infer<
  typeof updatePermissionarioSchema
>;
