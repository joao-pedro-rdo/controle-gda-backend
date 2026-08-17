import { z } from "zod";

export const imageFilenameParamsSchema = z.object({
  filename: z.string().trim().min(1, "Nome de arquivo obrigatório"),
});

export const systemImageTypeParamsSchema = z.object({
  type: z.enum(["logo", "background"]),
});

export type ImageFilenameParams = z.infer<typeof imageFilenameParamsSchema>;
export type SystemImageTypeParams = z.infer<
  typeof systemImageTypeParamsSchema
>;