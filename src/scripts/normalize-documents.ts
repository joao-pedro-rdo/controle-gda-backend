// Normaliza CPF e CNH já gravados para conter só dígitos (Fase 9).
//
// Por padrão só simula e mostra o que mudaria. Para gravar:
//   npm run normalize:documents -- --apply
// No Docker:
//   docker compose ... exec backend npm run normalize:documents -- --apply
//
// Registros com valor inválido (ex.: "N/A", CPF com dígito errado) não são
// alterados: aparecem na lista para correção manual pela tela.

import { prisma } from "../lib/prisma.js";
import { digitsOnly, isValidCpf } from "../lib/cpf.js";
import { isValidCnhNumber } from "../lib/text-rules.js";

export type DocumentKind = "cpf" | "cnh";

export interface FieldPlan {
  id: number;
  field: string;
  from: string;
  to?: string; // ausente = inválido, não será alterado
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

  const digits = digitsOnly(current);
  const valid =
    /^[\d.\-\s/]+$/.test(current) &&
    (kind === "cpf" ? isValidCpf(digits) : isValidCnhNumber(digits));

  if (!valid) return { id, field, from: current };
  if (digits === current) return null;
  return { id, field, from: current, to: digits };
}

async function main() {
  const apply = process.argv.includes("--apply");
  const plans: (FieldPlan & { table: string })[] = [];

  const vehicles = await prisma.vehicles.findMany({
    select: { id: true, idNumber: true, driverLicense: true },
  });
  for (const vehicle of vehicles) {
    const cpf = planValue("cpf", vehicle.id, "idNumber", vehicle.idNumber);
    const cnh = planValue("cnh", vehicle.id, "driverLicense", vehicle.driverLicense);
    if (cpf) plans.push({ table: "Vehicles", ...cpf });
    if (cnh) plans.push({ table: "Vehicles", ...cnh });
  }

  const visitorEntries = await prisma.entry.findMany({
    where: { isVisitor: true },
    select: { id: true, idNumber: true },
  });
  for (const entry of visitorEntries) {
    const cpf = planValue("cpf", entry.id, "idNumber", entry.idNumber);
    if (cpf) plans.push({ table: "Entry", ...cpf });
  }

  const changes = plans.filter((plan) => plan.to !== undefined);
  const invalid = plans.filter((plan) => plan.to === undefined);

  console.log(`Normalizáveis: ${changes.length}`);
  for (const plan of changes) {
    console.log(`  ${plan.table}#${plan.id}.${plan.field}: "${plan.from}" -> "${plan.to}"`);
  }
  console.log(`Inválidos (corrigir pela tela): ${invalid.length}`);
  for (const plan of invalid) {
    console.log(`  ${plan.table}#${plan.id}.${plan.field}: "${plan.from}"`);
  }

  if (!apply) {
    console.log("\nSimulação: nada foi gravado. Rode com --apply para gravar.");
    return;
  }

  await prisma.$transaction(
    changes.map((plan) =>
      plan.table === "Vehicles"
        ? prisma.vehicles.update({ where: { id: plan.id }, data: { [plan.field]: plan.to } })
        : prisma.entry.update({ where: { id: plan.id }, data: { [plan.field]: plan.to } })
    )
  );
  console.log(`\n${changes.length} valores gravados.`);
}

// Executa só quando chamado direto (o teste importa apenas planValue).
if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/normalize-documents.ts")) {
  main()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
