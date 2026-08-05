import { z } from "zod";

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
    name: z.string().trim().min(1, "Nome obrigatório").max(250),
    idNumber: z.string().trim().max(30).optional().default(""),
    CPF: z.string().trim().optional(),
    licensePlate: z.string().trim().max(10).optional(),
    carModel: z.string().trim().max(50).optional(),
    color: z.string().trim().max(20).optional().default(""),
    phoneNumber: z.string().trim().max(30).optional().default(""),
    contactPerson: z.string().trim().max(100).optional().default(""),
    target: z.string().trim().max(200).optional().default(""),
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

export const createScheduledEntrySchema = z.object({
  name: z.string().trim().min(1, "Nome obrigatório").max(250),
  idNumber: z.string().trim().min(1, "Identidade obrigatória").max(30),
  phoneNumber: z.string().trim().max(30).optional().default(""),
  licensePlate: z.string().trim().max(10).optional().default(""),
  carModel: z.string().trim().max(50).optional().default(""),
  color: z.string().trim().max(20).optional().default(""),
  contactPerson: z.string().trim().max(100).optional().default(""),
  target: z.string().trim().max(200).optional().default(""),
  scheduledDate: z
    .string()
    .min(1, "Data de agendamento obrigatória")
    .refine((value) => !isNaN(Date.parse(value)), "Data de agendamento inválida")
    .transform((value) => new Date(value)),
});

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
