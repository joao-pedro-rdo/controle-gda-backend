import { z } from "zod";

import { digitsOnly, isValidCpf } from "../lib/cpf.js";

const requiredString = z.string().trim().min(1, "Campo obrigatório");

const cpfField = z
  .string()
  .trim()
  .min(1, "CPF obrigatório")
  .refine(isValidCpf, "CPF inválido")
  .transform((value) => digitsOnly(value));

function optionalNullableField(max: number) {
  return z
    .string()
    .trim()
    .max(max, `Campo deve ter no máximo ${max} caracteres`)
    .optional()
    .transform((value) =>
      value === undefined || value === "" ? null : value
    );
}

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

export const createPessoaNaoAutorizadaSchema = z.object({
  nome: requiredString.max(150, "Nome deve ter no máximo 150 caracteres"),
  CPF: cpfField,
  identidade: optionalNullableField(30),
  observacao: optionalNullableField(500),
});

export const updatePessoaNaoAutorizadaSchema = z
  .object({
    nome: requiredString.max(150, "Nome deve ter no máximo 150 caracteres").optional(),
    CPF: cpfField.optional(),
    identidade: nullableUpdateField(30),
    observacao: nullableUpdateField(500),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Informe ao menos um campo para atualizar",
  });

export const pessoaNaoAutorizadaIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export type CreatePessoaNaoAutorizadaInput = z.infer<
  typeof createPessoaNaoAutorizadaSchema
>;
export type UpdatePessoaNaoAutorizadaInput = z.infer<
  typeof updatePessoaNaoAutorizadaSchema
>;