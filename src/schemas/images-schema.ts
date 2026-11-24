import { z } from "zod";

export const imageFilenameParamsSchema = z.object({
  filename: z.string().trim().min(1, "Nome de arquivo obrigatório"),
});

export type ImageFilenameParams = z.infer<typeof imageFilenameParamsSchema>;