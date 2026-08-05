// Handlers de migração de imagens de permissionários.
// Mantidos fora do refactor de Entries (pertencem à fase de uploads/imagens).
// Mantidos "as-is" para não alterar comportamento.

import { prisma } from "../helpers/utils.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { encryptImage } from "../helpers/imageEncryption.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const migratePermissionarioImages = async (request, reply) => {
  try {
    console.log("🔄 Iniciando migração de imagens de permissionários...");

    // Verificar se é admin
    if (!request.user || !["S2", "SFPC"].includes(request.user.role)) {
      return reply
        .status(403)
        .send({ error: "Acesso negado - apenas S2/SFPC" });
    }

    // Buscar todos os permissionários com imagePath
    const permissionarios = await prisma.permissionario.findMany({
      where: {
        imagePath: {
          not: null,
        },
      },
    });

    console.log(
      `📊 Encontrados ${permissionarios.length} permissionários com imagens`
    );

    let processed = 0;
    let errors = 0;
    let alreadyEncrypted = 0;
    const results = [];

    for (const permissionario of permissionarios) {
      try {
        const imagePath = permissionario.imagePath;

        // Verificar se já está criptografada
        if (imagePath.includes(".encrypted")) {
          console.log(
            `⚠️ Imagem já criptografada: ${permissionario.completeName}`
          );
          alreadyEncrypted++;
          continue;
        }

        // Construir caminho completo
        const fullPath = path.join(__dirname, "../../", imagePath);

        // Verificar se arquivo existe
        if (!fs.existsSync(fullPath)) {
          console.log(`❌ Arquivo não encontrado: ${fullPath}`);
          results.push({
            id: permissionario.id,
            name: permissionario.completeName,
            status: "file_not_found",
            originalPath: imagePath,
          });
          errors++;
          continue;
        }

        console.log(`🔄 Processando: ${permissionario.completeName}`);
        console.log(`📁 Arquivo original: ${fullPath}`);

        // Criptografar a imagem
        const encryptedPath = encryptImage(fullPath);
        console.log(`🔒 Imagem criptografada: ${encryptedPath}`);

        // Construir novo caminho relativo
        const newRelativePath = imagePath + ".encrypted";

        // Atualizar no banco de dados
        await prisma.permissionario.update({
          where: { id: permissionario.id },
          data: { imagePath: newRelativePath },
        });

        // Remover arquivo original
        fs.unlinkSync(fullPath);
        console.log(`🗑️ Arquivo original removido: ${fullPath}`);

        results.push({
          id: permissionario.id,
          name: permissionario.completeName,
          status: "success",
          originalPath: imagePath,
          encryptedPath: newRelativePath,
        });

        processed++;
        console.log(`✅ ${permissionario.completeName} - Migração concluída`);
      } catch (error) {
        console.error(
          `❌ Erro ao processar ${permissionario.completeName}:`,
          error
        );
        results.push({
          id: permissionario.id,
          name: permissionario.completeName,
          status: "error",
          error: error.message,
          originalPath: permissionario.imagePath,
        });
        errors++;
      }
    }

    const summary = {
      total: permissionarios.length,
      processed,
      errors,
      alreadyEncrypted,
      details: results,
    };

    console.log("📊 Resumo da migração:", summary);

    reply.status(200).send({
      message: "Migração de imagens concluída",
      summary,
    });
  } catch (error) {
    console.error("❌ Erro geral na migração:", error);
    reply.status(500).send({
      message: "Erro na migração de imagens",
      error: error.message,
    });
  }
};

export const migratePermissionarioImageById = async (request, reply) => {
  try {
    const { id } = request.params;

    // Verificar se é admin
    if (!request.user || !["S2", "SFPC"].includes(request.user.role)) {
      return reply
        .status(403)
        .send({ error: "Acesso negado - apenas S2/SFPC" });
    }

    // Buscar permissionário específico
    const permissionario = await prisma.permissionario.findUnique({
      where: { id: parseInt(id) },
    });

    if (!permissionario || !permissionario.imagePath) {
      return reply
        .status(404)
        .send({ error: "Permissionário não encontrado ou sem imagem" });
    }

    // Verificar se já está criptografada
    if (permissionario.imagePath.includes(".encrypted")) {
      return reply.status(400).send({ error: "Imagem já está criptografada" });
    }

    // Construir caminho completo
    const fullPath = path.join(__dirname, "../../", permissionario.imagePath);

    // Verificar se arquivo existe
    if (!fs.existsSync(fullPath)) {
      return reply
        .status(404)
        .send({ error: "Arquivo de imagem não encontrado" });
    }

    console.log(`🔄 Criptografando imagem de: ${permissionario.completeName}`);

    // Criptografar a imagem
    const encryptedPath = encryptImage(fullPath);
    const newRelativePath = permissionario.imagePath + ".encrypted";

    // Atualizar no banco de dados
    await prisma.permissionario.update({
      where: { id: parseInt(id) },
      data: { imagePath: newRelativePath },
    });

    // Remover arquivo original
    fs.unlinkSync(fullPath);

    console.log(`✅ Migração concluída para: ${permissionario.completeName}`);

    reply.status(200).send({
      message: "Imagem criptografada com sucesso",
      permissionario: {
        id: permissionario.id,
        name: permissionario.completeName,
        originalPath: permissionario.imagePath,
        encryptedPath: newRelativePath,
      },
    });
  } catch (error) {
    console.error("❌ Erro na migração individual:", error);
    reply.status(500).send({
      message: "Erro ao criptografar imagem",
      error: error.message,
    });
  }
};
