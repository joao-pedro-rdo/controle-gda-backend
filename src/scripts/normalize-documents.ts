// Normaliza documentos e placas já gravados por versões antigas (Fase 9).
//
// O sistema novo grava CPF/CNH só com dígitos e placa sem hífen e em
// maiúsculas, e as buscas (QR, placa, CPF) comparam o valor exato. Dados
// antigos com máscara deixariam de ser encontrados até rodar este script.
//
// Por padrão só simula e mostra o que mudaria. Para gravar:
//   npm run normalize:documents -- --apply
// No Docker:
//   docker compose ... exec backend npm run normalize:documents -- --apply
//
// Valores inválidos (ex.: "N/A", CPF com dígito errado) e os que colidiriam
// com outro registro não são alterados: aparecem na lista para correção
// manual pela tela. O script pode ser rodado de novo sem efeito colateral.

import { prisma } from "../lib/prisma.js";
import { digitsOnly, isValidCpf } from "../lib/cpf.js";
import { isValidCnhNumber } from "../lib/text-rules.js";
import { isValidPlate } from "../schemas/vehicles-schema.js";

export type DocumentKind = "cpf" | "cnh" | "plate";

export interface FieldPlan {
  id: number;
  field: string;
  from: string;
  to?: string; // ausente = inválido ou em conflito, não será alterado
  reason?: string;
}

export function normalizePlateValue(value: string): string {
  return value.replace(/[\s.-]/g, "").toUpperCase();
}

// Decide o que fazer com um valor: nada, normalizar ou reportar.
export function planValue(
  kind: DocumentKind,
  id: number,
  field: string,
  value: string | null | undefined
): FieldPlan | null {
  const current = (value ?? "").trim();
  if (current === "") return null;

  if (kind === "plate") {
    if (!isValidPlate(current)) return { id, field, from: current, reason: "inválido" };
    const plate = normalizePlateValue(current);
    return plate === current ? null : { id, field, from: current, to: plate };
  }

  const digits = digitsOnly(current);
  const valid =
    /^[\d.\-\s/]+$/.test(current) &&
    (kind === "cpf" ? isValidCpf(digits) : isValidCnhNumber(digits));

  if (!valid) return { id, field, from: current, reason: "inválido" };
  if (digits === current) return null;
  return { id, field, from: current, to: digits };
}

// Para colunas únicas (ou que deveriam ser): não normaliza um valor que
// ficaria igual ao de outro registro; reporta para decisão manual.
export function markConflicts(
  plans: FieldPlan[],
  rows: { id: number; value: string | null }[],
  normalize: (value: string) => string
): FieldPlan[] {
  const owners = new Map<string, number[]>();
  for (const row of rows) {
    const value = (row.value ?? "").trim();
    if (!value) continue;
    const key = normalize(value);
    owners.set(key, [...(owners.get(key) ?? []), row.id]);
  }
  return plans.map((plan) => {
    if (plan.to === undefined) return plan;
    const others = (owners.get(plan.to) ?? []).filter((id) => id !== plan.id);
    if (others.length === 0) return plan;
    return {
      id: plan.id,
      field: plan.field,
      from: plan.from,
      reason: `mesmo valor do registro #${others.join(", #")}`,
    };
  });
}

type Table = "Vehicles" | "Permissionario" | "PessoaNaoAutorizada" | "Entry";
type TablePlan = FieldPlan & { table: Table };

function collect(table: Table, list: (FieldPlan | null)[], into: TablePlan[]) {
  for (const plan of list) if (plan) into.push({ table, ...plan });
}

async function main() {
  const apply = process.argv.includes("--apply");
  const plans: TablePlan[] = [];
  let ignoredEntryPlates = 0;

  // Veículos cadastrados (QR e busca por placa)
  const vehicles = await prisma.vehicles.findMany({
    select: { id: true, idNumber: true, driverLicense: true, licensePlate: true },
  });
  const vehiclePlates = vehicles.map((v) => planValue("plate", v.id, "licensePlate", v.licensePlate));
  collect("Vehicles", vehicles.map((v) => planValue("cpf", v.id, "idNumber", v.idNumber)), plans);
  collect("Vehicles", vehicles.map((v) => planValue("cnh", v.id, "driverLicense", v.driverLicense)), plans);
  collect(
    "Vehicles",
    markConflicts(
      vehiclePlates.filter(Boolean) as FieldPlan[],
      vehicles.map((v) => ({ id: v.id, value: v.licensePlate })),
      normalizePlateValue
    ),
    plans
  );

  // Permissionários: CPF já é VarChar(11); só a placa pode estar com máscara
  const permissionarios = await prisma.permissionario.findMany({
    select: { id: true, licensePlate: true },
  });
  collect(
    "Permissionario",
    permissionarios.map((p) => planValue("plate", p.id, "licensePlate", p.licensePlate)),
    plans
  );

  // Pessoas não autorizadas: CPF é único e usado na verificação de entrada
  const pessoas = await prisma.pessoaNaoAutorizada.findMany({ select: { id: true, CPF: true } });
  collect(
    "PessoaNaoAutorizada",
    markConflicts(
      pessoas.map((p) => planValue("cpf", p.id, "CPF", p.CPF)).filter(Boolean) as FieldPlan[],
      pessoas.map((p) => ({ id: p.id, value: p.CPF })),
      digitsOnly
    ),
    plans
  );

  // Histórico de entradas: CPF do visitante (autopreenchimento) e placa
  // (busca do relatório). Placas inválidas no histórico ("N/A", vazio de
  // militar etc.) são comuns e só entram na contagem.
  const entries = await prisma.entry.findMany({
    select: { id: true, isVisitor: true, idNumber: true, licensePlate: true },
  });
  for (const entry of entries) {
    if (entry.isVisitor) collect("Entry", [planValue("cpf", entry.id, "idNumber", entry.idNumber)], plans);
    const plate = planValue("plate", entry.id, "licensePlate", entry.licensePlate);
    if (plate?.to !== undefined) plans.push({ table: "Entry", ...plate });
    else if (plate) ignoredEntryPlates++;
  }

  const changes = plans.filter((plan) => plan.to !== undefined);
  const pending = plans.filter((plan) => plan.to === undefined);

  console.log(`Normalizáveis: ${changes.length}`);
  for (const plan of changes) {
    console.log(`  ${plan.table}#${plan.id}.${plan.field}: "${plan.from}" -> "${plan.to}"`);
  }
  console.log(`\nNão alterados (corrigir pela tela): ${pending.length}`);
  for (const plan of pending) {
    console.log(`  ${plan.table}#${plan.id}.${plan.field}: "${plan.from}" (${plan.reason})`);
  }
  if (ignoredEntryPlates > 0) {
    console.log(`\nPlacas fora do padrão no histórico de entradas (mantidas): ${ignoredEntryPlates}`);
  }

  if (!apply) {
    console.log("\nSimulação: nada foi gravado. Rode com --apply para gravar.");
    return;
  }

  // Lotes para não montar uma transação gigante com históricos grandes.
  const BATCH = 500;
  for (let i = 0; i < changes.length; i += BATCH) {
    await prisma.$transaction(
      changes.slice(i, i + BATCH).map((plan) => {
        const args = { where: { id: plan.id }, data: { [plan.field]: plan.to } };
        switch (plan.table) {
          case "Vehicles":
            return prisma.vehicles.update(args);
          case "Permissionario":
            return prisma.permissionario.update(args);
          case "PessoaNaoAutorizada":
            return prisma.pessoaNaoAutorizada.update(args);
          default:
            return prisma.entry.update(args);
        }
      })
    );
  }
  console.log(`\n${changes.length} valores gravados.`);
}

// Executa só quando chamado direto (o teste importa apenas as funções puras).
if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/normalize-documents.ts")) {
  main()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
