// Importação de veículos por CSV (perfil S2).
//
// Cada linha passa pelas mesmas regras do cadastro pela tela
// (`vehicleCsvRowSchema`), e a gravação usa o mesmo service, então placa
// duplicada, CPF inválido e caracteres especiais são tratados igual.
//
// Colunas (cabeçalho, sem diferenciar maiúsculas): NOME, POSTO, MODELO,
// PLACA, COR obrigatórias; CPF, CNH, SECAO, ESQUADRAO opcionais. Aceita
// separador "," ou ";" (padrão do Excel em pt-BR).

import { parseString } from "fast-csv";
import { z } from "zod";

import { AppError } from "../lib/errors.js";
import { cpfDigits } from "../lib/text-rules.js";
import { createVehicleSchema } from "../schemas/vehicles-schema.js";
import { vehicleService, type VehicleService } from "./vehicle-service.js";

// Planilhas antigas não têm CPF: aceita vazio, mas valida quando informado.
export const vehicleCsvRowSchema = createVehicleSchema.extend({
  idNumber: z
    .string()
    .optional()
    .default("")
    .transform((value, ctx) => {
      if (value.trim() === "") return "";
      const cpf = cpfDigits.safeParse(value);
      if (!cpf.success) {
        cpf.error.issues.forEach((issue) => ctx.addIssue(issue));
        return z.NEVER;
      }
      return cpf.data;
    }),
});

const COLUMN_MAP: Record<string, keyof z.input<typeof vehicleCsvRowSchema>> = {
  NOME: "completeName",
  POSTO: "tagName",
  MODELO: "carModel",
  PLACA: "licensePlate",
  COR: "color",
  CPF: "idNumber",
  CNH: "driverLicense",
  SECAO: "section",
  "SEÇÃO": "section",
  ESQUADRAO: "company",
  "ESQUADRÃO": "company",
};

export interface CsvImportError {
  linha: number;
  placa?: string;
  erro: string;
}

export interface CsvImportResult {
  total: number;
  sucessos: number;
  falhas: number;
  duplicados: number;
  erros: CsvImportError[];
}

function detectDelimiter(text: string): "," | ";" {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const semicolons = (firstLine.match(/;/g) ?? []).length;
  const commas = (firstLine.match(/,/g) ?? []).length;
  return semicolons > commas ? ";" : ",";
}

function normalizeHeader(header: string | null | undefined): string {
  return (header ?? "").replace(/^﻿/, "").trim().toUpperCase();
}

export function parseVehiclesCsv(text: string): Promise<Record<string, string>[]> {
  return new Promise((resolve, reject) => {
    const rows: Record<string, string>[] = [];
    parseString(text, {
      headers: (headers) => headers.map(normalizeHeader),
      delimiter: detectDelimiter(text),
      ignoreEmpty: true,
      trim: true,
    })
      .on("error", reject)
      .on("data", (row: Record<string, string>) => rows.push(row))
      .on("end", () => resolve(rows));
  });
}

function mapRow(row: Record<string, string>): Record<string, string> {
  const mapped: Record<string, string> = {};
  for (const [column, value] of Object.entries(row)) {
    const field = COLUMN_MAP[column];
    if (field && value !== undefined) mapped[field] = value;
  }
  return mapped;
}

export async function importVehiclesCsv(
  text: string,
  service: VehicleService = vehicleService
): Promise<CsvImportResult> {
  const rows = await parseVehiclesCsv(text);
  const result: CsvImportResult = {
    total: rows.length,
    sucessos: 0,
    falhas: 0,
    duplicados: 0,
    erros: [],
  };
  const platesInFile = new Set<string>();

  for (const [index, row] of rows.entries()) {
    const linha = index + 2; // linha 1 é o cabeçalho
    const parsed = vehicleCsvRowSchema.safeParse(mapRow(row));

    if (!parsed.success) {
      result.falhas++;
      result.erros.push({
        linha,
        placa: row.PLACA,
        erro: parsed.error.issues
          .map((issue) => `${issue.path.join(".") || "linha"}: ${issue.message}`)
          .join("; "),
      });
      continue;
    }

    const vehicle = parsed.data;
    if (platesInFile.has(vehicle.licensePlate)) {
      result.duplicados++;
      result.erros.push({ linha, placa: vehicle.licensePlate, erro: "Placa repetida no arquivo" });
      continue;
    }
    platesInFile.add(vehicle.licensePlate);

    try {
      await service.create(vehicle);
      result.sucessos++;
    } catch (error) {
      if (error instanceof AppError && error.statusCode === 409) {
        result.duplicados++;
        result.erros.push({ linha, placa: vehicle.licensePlate, erro: "Veículo já cadastrado com esta placa" });
        continue;
      }
      throw error;
    }
  }

  return result;
}
