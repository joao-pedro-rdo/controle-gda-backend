import { z } from "zod";

import { digitsOnly, isValidCpf } from "../lib/cpf.js";
import { cpfDigits, phoneText, requiredShortText, shortText } from "../lib/text-rules.js";
import { isValidPlate } from "./vehicles-schema.js";

function normalizePlate(value: string): string {
  return value.replace(/[\s.-]/g, "").toUpperCase();
}

type VisitorFields = {
  idNumber?: string;
  licensePlate?: string;
  carModel?: string;
  color?: string;
};

// Regras do visitante: CPF válido e, salvo se veio a pé, veículo completo.
function checkVisitorFields(
  data: VisitorFields,
  onFoot: boolean,
  ctx: z.RefinementCtx
) {
  const cpf = data.idNumber ?? "";
  if (!isValidCpf(cpf) || !/^[\d.\-\s]+$/.test(cpf)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "CPF inválido", path: ["idNumber"] });
  }
  if (onFoot) return;
  if (!data.licensePlate || !isValidPlate(data.licensePlate)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: data.licensePlate ? "Placa inválida" : "Placa obrigatória (ou marque \"A pé\")",
      path: ["licensePlate"],
    });
  }
  if (!data.carModel) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Modelo obrigatório", path: ["carModel"] });
  }
  if (!data.color) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Cor obrigatória", path: ["color"] });
  }
}

// Visitante a pé grava os campos do veículo vazios; com veículo, placa
// normalizada. CPF do visitante é gravado só com dígitos.
function normalizeVisitorFields<T extends VisitorFields>(data: T, onFoot: boolean): T {
  return {
    ...data,
    idNumber: digitsOnly(data.idNumber ?? ""),
    licensePlate: onFoot ? "" : normalizePlate(data.licensePlate ?? ""),
    carModel: onFoot ? "" : data.carModel,
    color: onFoot ? "" : data.color,
  };
}

const stringBool = z
  .union([z.literal("true"), z.literal("false")])
  .optional();

function parseStringBool(value: string | undefined): boolean {
  return value === "true";
}

// Campos comuns enviados como texto via multipart (createEntry/confirm).
// O formulário envia os valores como strings; convertemos aqui com segurança.
export const createEntrySchema = z
  .object({
    type: z.enum(["Entrada", "Saída"]).default("Entrada"),
    isVisitor: stringBool,
    isPermissionario: stringBool,
    isScheduled: stringBool,
    isMilitar: stringBool,
    // Visitante sem veículo.
    onFoot: stringBool,
    name: requiredShortText("Nome", 250),
    idNumber: shortText("Documento", 30).optional().default(""),
    CPF: z.string().trim().optional(),
    licensePlate: shortText("Placa", 10).optional(),
    carModel: shortText("Modelo", 50).optional(),
    color: shortText("Cor", 20).optional().default(""),
    phoneNumber: phoneText("Telefone", 30).optional().default(""),
    contactPerson: shortText("Contato", 100).optional().default(""),
    target: shortText("Destino", 200).optional().default(""),
  })
  .superRefine((data, ctx) => {
    const isVisitorEntry =
      parseStringBool(data.isVisitor) && (data.type ?? "Entrada") === "Entrada";
    if (isVisitorEntry) {
      checkVisitorFields(data, parseStringBool(data.onFoot), ctx);
    }
  })
  .transform((data) => {
    const isVisitorEntry = parseStringBool(data.isVisitor) && data.type === "Entrada";
    return isVisitorEntry
      ? normalizeVisitorFields(data, parseStringBool(data.onFoot))
      : data;
  })
  .transform((data) => ({
    type: data.type,
    isVisitor: parseStringBool(data.isVisitor),
    isPermissionario: parseStringBool(data.isPermissionario),
    isScheduled: parseStringBool(data.isScheduled),
    isMilitar: parseStringBool(data.isMilitar),
    name: data.name,
    idNumber: data.idNumber,
    CPF: data.CPF,
    licensePlate: data.licensePlate,
    carModel: data.carModel,
    color: data.color,
    phoneNumber: data.phoneNumber,
    contactPerson: data.contactPerson,
    target: data.target,
  }))
  .refine((data) => !(data.isVisitor && data.isPermissionario), {
    message: "Um registro não pode ser visitante e permissionário ao mesmo tempo",
    path: ["isPermissionario"],
  })
  .refine((data) => !(data.type === "Saída" && data.isScheduled), {
    message: "Tipo inconsistente: agendamento não pode ser do tipo Saída",
    path: ["type"],
  });

const mayBool = z
  .union([z.boolean(), z.literal("true"), z.literal("false")])
  .transform((value) => value === true || value === "true");

export const createExitSchema = z.object({
  entryId: z.coerce.number().int().positive(),
  name: z.string().trim().min(1, "Nome obrigatório").max(250),
  idNumber: z.string().trim().max(30).optional().default(""),
  phoneNumber: z.string().trim().max(30).optional().default(""),
  licensePlate: z.string().trim().max(10).optional().default(""),
  carModel: z.string().trim().max(50).optional().default(""),
  color: z.string().trim().max(20).optional().default(""),
  target: z.string().trim().max(200).optional().default(""),
  contactPerson: z.string().trim().max(100).optional().default(""),
  isVisitor: mayBool.optional().default(false),
  isPermissionario: mayBool.optional().default(false),
  CPF: z.string().trim().optional(),
  imagePath: z.string().nullable().optional(),
});

export const createScheduledEntrySchema = z
  .object({
    name: requiredShortText("Nome", 250),
    idNumber: z.string().trim().min(1, "CPF obrigatório").max(30),
    phoneNumber: phoneText("Telefone", 30).optional().default(""),
    onFoot: mayBool.optional().default(false),
    licensePlate: shortText("Placa", 10).optional().default(""),
    carModel: shortText("Modelo", 50).optional().default(""),
    color: shortText("Cor", 20).optional().default(""),
    contactPerson: shortText("Contato", 100).optional().default(""),
    target: shortText("Destino", 200).optional().default(""),
    scheduledDate: z
      .string()
      .min(1, "Data de agendamento obrigatória")
      .refine((value) => !isNaN(Date.parse(value)), "Data de agendamento inválida")
      .transform((value) => new Date(value)),
  })
  .superRefine((data, ctx) => checkVisitorFields(data, data.onFoot, ctx))
  .transform(({ onFoot, ...data }) => normalizeVisitorFields(data, onFoot));

const includeScheduledBool = z
  .union([z.boolean(), z.literal("true"), z.literal("false")])
  .optional()
  .transform((value) => value === true || value === "true");

const dateRange = z
  .object({
    initialDate: z
      .string()
      .min(1, "initialDate obrigatória")
      .refine((value) => !isNaN(Date.parse(value)), "Data inicial inválida")
      .transform((value) => new Date(value)),
    finalDate: z
      .string()
      .min(1, "finalDate obrigatória")
      .refine((value) => !isNaN(Date.parse(value)), "Data final inválida")
      .transform((value) => new Date(value)),
    includeScheduled: includeScheduledBool,
  })
  .refine((data) => data.finalDate > data.initialDate, {
    message: "finalDate deve ser posterior a initialDate",
    path: ["finalDate"],
  });

export const dateRangeQuerySchema = dateRange;

export const scheduledDateQuerySchema = z.object({
  date: z
    .string()
    .optional()
    .refine(
      (value) => value === undefined || !isNaN(Date.parse(value)),
      "Data inválida"
    ),
});

export const visitorCpfParamsSchema = z.object({ cpf: cpfDigits });

export const entryIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const confirmScheduledEntryParamsSchema = entryIdParamsSchema;

export const updateEntrySchema = z.object({
  id: z.coerce.number().int().positive(),
  exited: z.boolean(),
});

export type CreateEntryInput = z.input<typeof createEntrySchema>;
export type CreateEntryParsed = z.output<typeof createEntrySchema>;
export type CreateExitInput = z.infer<typeof createExitSchema>;
export type CreateScheduledEntryInput = z.infer<
  typeof createScheduledEntrySchema
>;
export type DateRangeQuery = z.infer<typeof dateRangeQuerySchema>;
