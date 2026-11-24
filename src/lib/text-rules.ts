// Regras de texto compartilhadas pelos schemas Zod.
//
// Objetivo: bloquear caracteres que quebram telas, relatórios e exportações
// (<, >, {, }, `, $, \, |, ; ...), mantendo acentos e cedilha.

import { z } from "zod";

import { digitsOnly, isValidCpf } from "./cpf.js";

// Nomes de pessoa: letras (com acento/ç), espaço, apóstrofo, ponto e hífen.
export const PERSON_NAME_PATTERN = /^[\p{L}\s'.-]+$/u;

// Textos curtos (P/G, modelo, seção, contato, local, cor): também números,
// barra, vírgula, parênteses e indicadores ordinais (3º Sgt, 2ª Seção).
export const SHORT_TEXT_PATTERN = /^[\p{L}\p{N}\s'.,/()ºª°&-]+$/u;

// Textos longos (observações): pontuação comum de frase.
export const LONG_TEXT_PATTERN = /^[\p{L}\p{N}\s'.,/()ºª°&:;!?"%+-]+$/u;

// Telefone: dígitos e símbolos de máscara.
export const PHONE_PATTERN = /^[\d\s()+-]+$/;

export const PERSON_NAME_MESSAGE =
  "use apenas letras, espaços, apóstrofo, ponto ou hífen";
export const SHORT_TEXT_MESSAGE = "contém caracteres não permitidos";

export function personName(field: string, max: number) {
  return z
    .string()
    .trim()
    .min(1, `${field} obrigatório`)
    .max(max, `${field} deve ter no máximo ${max} caracteres`)
    .regex(PERSON_NAME_PATTERN, `${field}: ${PERSON_NAME_MESSAGE}`);
}

function patterned(
  field: string,
  max: number,
  pattern: RegExp
) {
  return z
    .string()
    .trim()
    .max(max, `${field} deve ter no máximo ${max} caracteres`)
    .refine(
      (value) => value === "" || pattern.test(value),
      `${field} ${SHORT_TEXT_MESSAGE}`
    );
}

// Texto curto que pode ser vazio. Obrigatoriedade fica a cargo do schema.
export function shortText(field: string, max: number) {
  return patterned(field, max, SHORT_TEXT_PATTERN);
}

export function requiredShortText(field: string, max: number) {
  return z
    .string()
    .trim()
    .min(1, `${field} obrigatório`)
    .pipe(shortText(field, max));
}

export function longText(field: string, max: number) {
  return patterned(field, max, LONG_TEXT_PATTERN);
}

export function phoneText(field: string, max: number) {
  return z
    .string()
    .trim()
    .max(max, `${field} deve ter no máximo ${max} caracteres`)
    .refine(
      (value) => value === "" || PHONE_PATTERN.test(value),
      `${field} deve conter apenas números`
    );
}

// CPF: aceita com ou sem máscara, exige apenas dígitos e pontuação da
// máscara, valida dígitos verificadores e devolve só os 11 dígitos.
export const CPF_INPUT_PATTERN = /^[\d.\-\s]+$/;

export const cpfDigits = z
  .string()
  .trim()
  .min(1, "CPF obrigatório")
  .refine((value) => CPF_INPUT_PATTERN.test(value), "CPF deve conter apenas números")
  .refine((value) => digitsOnly(value).length === 11, "CPF deve ter 11 dígitos")
  .refine(isValidCpf, "CPF inválido")
  .transform((value) => digitsOnly(value));

// CNH (número de registro): 11 dígitos. Vazio é permitido (campo opcional).
export const CNH_INPUT_PATTERN = /^[\d.\-\s]*$/;

export function isValidCnhNumber(value: string): boolean {
  const digits = digitsOnly(value);
  return digits.length === 11 && !/^(\d)\1{10}$/.test(digits);
}

export const optionalCnhDigits = z
  .string()
  .trim()
  .refine((value) => CNH_INPUT_PATTERN.test(value), "Habilitação deve conter apenas números")
  .refine(
    (value) => digitsOnly(value) === "" || isValidCnhNumber(value),
    "Habilitação deve ter 11 dígitos"
  )
  .transform((value) => digitsOnly(value));
