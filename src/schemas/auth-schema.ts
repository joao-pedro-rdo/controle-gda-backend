import { z } from "zod";

const requiredString = z.string().trim().min(1, "Campo obrigatório");

export const loginSchema = z.object({
  login: requiredString.max(50, "Login deve ter no máximo 50 caracteres"),
  password: z.string().min(1, "Senha obrigatória"),
});

export const signupSchema = z.object({
  login: requiredString.max(50, "Login deve ter no máximo 50 caracteres"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
  role: requiredString.max(30, "Perfil deve ter no máximo 30 caracteres"),
});

export const updateUserSchema = z
  .object({
    login: requiredString.max(50, "Login deve ter no máximo 50 caracteres").optional(),
    password: z
      .string()
      .min(6, "Senha deve ter pelo menos 6 caracteres")
      .optional(),
    role: requiredString.max(30, "Perfil deve ter no máximo 30 caracteres").optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Informe ao menos um campo para atualizar",
  });

export const updatePasswordSchema = z.object({
  login: requiredString.max(50, "Login deve ter no máximo 50 caracteres"),
  oldPass: z.string().min(1, "Senha antiga obrigatória"),
  newPass: z.string().min(6, "Nova senha deve ter pelo menos 6 caracteres"),
});

export const userIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>;
