import { z } from "zod";

import {
  cpfDigits,
  optionalCnhDigits,
  personName,
  requiredShortText,
  shortText,
} from "../lib/text-rules.js";

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

// Campos de veículo compartilhados com a importação CSV.
export const vehicleFields = {
  completeName: personName("Nome completo", 150),
  tagName: requiredShortText("P/G - Nome de guerra", 100),
  carModel: requiredShortText("Modelo", 50),
  licensePlate: plateSchema,
  color: requiredShortText("Cor", 20),
  driverLicense: optionalCnhDigits,
  idNumber: cpfDigits,
  company: shortText("Esquadrão", 10),
  section: shortText("Seção", 50),
};

export const createVehicleSchema = z.object({
  ...vehicleFields,
  driverLicense: vehicleFields.driverLicense.optional().default(""),
  company: vehicleFields.company.optional().default(""),
  section: vehicleFields.section.optional().default(""),
});

export const updateVehicleSchema = z
  .object({
    completeName: vehicleFields.completeName.optional(),
    tagName: vehicleFields.tagName.optional(),
    carModel: vehicleFields.carModel.optional(),
    licensePlate: vehicleFields.licensePlate.optional(),
    color: vehicleFields.color.optional(),
    driverLicense: vehicleFields.driverLicense.optional(),
    idNumber: vehicleFields.idNumber.optional(),
    company: vehicleFields.company.optional(),
    section: vehicleFields.section.optional(),
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
