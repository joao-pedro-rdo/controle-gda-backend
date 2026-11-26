import { z } from "zod";

import { digitsOnly } from "../lib/cpf.js";
import { cpfDigits, personName, shortText } from "../lib/text-rules.js";
import { isValidPlate } from "./vehicles-schema.js";

function nullableField(field: string, max: number) {
  return shortText(field, max)
    .optional()
    .transform((value) =>
      value === undefined || value === "" ? null : value
    );
}

const cpfField = cpfDigits;

const plateText = z
  .string()
  .trim()
  .max(10, "Placa deve ter no máximo 10 caracteres")
  .refine((value) => value === "" || isValidPlate(value), "Placa inválida");

const optionalPlate = plateText
  .optional()
  .transform((value) => {
    if (value === undefined || value === "") return null;
    return value.replace(/[\s.-]/g, "").toUpperCase();
  });

function nullableUpdateField(field: string, max: number) {
  return shortText(field, max)
    .optional()
    .transform((value) => {
      if (value === undefined) return undefined;
      return value === "" ? null : value;
    });
}

const optionalPlateUpdate = plateText
  .optional()
  .transform((value) => {
    if (value === undefined) return undefined;
    if (value === "") return null;
    return value.replace(/[\s.-]/g, "").toUpperCase();
  });

export const createPermissionarioSchema = z.object({
  completeName: personName("Nome completo", 150),
  CPF: cpfField,
  local: nullableField("Local", 100),
  carModel: nullableField("Modelo", 50),
  licensePlate: optionalPlate,
  color: nullableField("Cor", 20),
});

export const updatePermissionarioSchema = z
  .object({
    completeName: personName("Nome completo", 150).optional(),
    CPF: cpfField.optional(),
    local: nullableUpdateField("Local", 100),
    carModel: nullableUpdateField("Modelo", 50),
    licensePlate: optionalPlateUpdate,
    color: nullableUpdateField("Cor", 20),
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
