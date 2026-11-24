// Criptografa imagens de permissionário gravadas antes da criptografia em
// disco (substitui as rotas /migrate-permissionario-image*).
//
// Por padrão só simula. Para gravar:
//   npm run encrypt:permissionario-images -- --apply
// No Docker:
//   docker compose ... exec backend npm run encrypt:permissionario-images -- --apply

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { prisma } from "../lib/prisma.js";
import { encryptImage, getEncryptedPath, isEncryptedImage } from "../helpers/imageEncryption.js";

// imagePath é relativo à raiz do backend (ex.: uploads/permissionarios/x.jpg).
const BACKEND_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

async function main() {
  const apply = process.argv.includes("--apply");
  const permissionarios = await prisma.permissionario.findMany({
    where: { imagePath: { not: null } },
    select: { id: true, completeName: true, imagePath: true },
  });

  const pending = permissionarios.filter((p) => !isEncryptedImage(p.imagePath ?? ""));
  let done = 0;
  let missing = 0;
  let failed = 0;

  console.log(`Permissionários com imagem: ${permissionarios.length}`);
  console.log(`Já criptografadas: ${permissionarios.length - pending.length}`);

  for (const permissionario of pending) {
    const imagePath = permissionario.imagePath as string;
    const fullPath = path.join(BACKEND_ROOT, imagePath);
    const label = `#${permissionario.id} ${permissionario.completeName}`;

    if (!fs.existsSync(fullPath)) {
      missing++;
      console.log(`  arquivo ausente: ${label} (${imagePath})`);
      continue;
    }
    if (!apply) {
      console.log(`  criptografaria: ${label} (${imagePath})`);
      continue;
    }
    try {
      encryptImage(fullPath); // grava .encrypted e remove o original
      await prisma.permissionario.update({
        where: { id: permissionario.id },
        data: { imagePath: getEncryptedPath(imagePath) },
      });
      done++;
    } catch (error) {
      failed++;
      console.error(`  erro: ${label}:`, error instanceof Error ? error.message : error);
    }
  }

  console.log(`Pendentes: ${pending.length} | arquivo ausente: ${missing}`);
  if (apply) console.log(`Criptografadas agora: ${done} | erros: ${failed}`);
  else console.log("\nSimulação: nada foi gravado. Rode com --apply para gravar.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
