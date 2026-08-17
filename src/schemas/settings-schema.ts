import { z } from "zod";

const optionalTrimmed = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} deve ter no máximo ${max} caracteres`)
    .optional();

const hexColorField = z
  .string()
  .trim()
  .max(50, "Cor deve ter no máximo 50 caracteres")
  .refine(
    (value) => /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value),
    "Cor deve estar no formato hexadecimal (ex.: #dc2626)"
  );

export const updateColorsSchema = z.object({
  primaryColor: hexColorField.optional(),
  secondaryColor: hexColorField.optional(),
});

export const updateSystemSettingsSchema = z.object({
  pageTitle: optionalTrimmed(150, "Título do sistema"),
  logo: optionalTrimmed(255, "Caminho do logo"),
  background: optionalTrimmed(255, "Caminho do background"),
});

export const createDestinationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Nome do destino é obrigatório")
    .max(100, "Nome do destino deve ter no máximo 100 caracteres"),
});

export const destinationNameParamsSchema = z.object({
  name: z.string().trim().min(1, "Nome do destino é obrigatório"),
});

export type UpdateColorsInput = z.infer<typeof updateColorsSchema>;
export type UpdateSystemSettingsInput = z.infer<
  typeof updateSystemSettingsSchema
>;
export type CreateDestinationInput = z.infer<typeof createDestinationSchema>;
export type DestinationNameParams = z.infer<
  typeof destinationNameParamsSchema
>;