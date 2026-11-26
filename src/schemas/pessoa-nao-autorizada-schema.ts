import { z } from "zod";

import { cpfDigits, longText, personName, shortText } from "../lib/text-rules.js";

const cpfField = cpfDigits;

function optionalNullableField(text: z.ZodTypeAny) {
  return text
    .optional()
    .transform((value) =>
      value === undefined || value === "" ? null : value
    );
}

function nullableUpdateField(text: z.ZodTypeAny) {
  return text
    .optional()
    .transform((value) => {
      if (value === undefined) return undefined;
      return value === "" ? null : value;
    });
}

export const createPessoaNaoAutorizadaSchema = z.object({
  nome: personName("Nome", 150),
  CPF: cpfField,
  observacao: optionalNullableField(longText("Observação", 500)),
});

export const updatePessoaNaoAutorizadaSchema = z
  .object({
    nome: personName("Nome", 150).optional(),
    CPF: cpfField.optional(),
    observacao: nullableUpdateField(longText("Observação", 500)),
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