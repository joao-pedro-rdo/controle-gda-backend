import { z } from "zod";

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

export type CreateDestinationInput = z.infer<typeof createDestinationSchema>;
export type DestinationNameParams = z.infer<
  typeof destinationNameParamsSchema
>;