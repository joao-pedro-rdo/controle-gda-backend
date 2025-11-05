import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { decryptImage, isEncryptedImage } from "../helpers/imageEncryption.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const getVisitorImage = async (request, reply) => {
  try {
    const { filename } = request.params;

    // Determinar se é arquivo criptografado
    const isEncrypted = isEncryptedImage(filename);
    const actualFilename = isEncrypted ? filename : `${filename}.encrypted`;

    const imagePath = path.join(
      __dirname,
      "../../uploads/visitors",
      actualFilename
    );

    console.log("🖼️ Buscando imagem:", imagePath);

    if (!fs.existsSync(imagePath)) {
      console.log("❌ Imagem não encontrada:", imagePath);
      return reply.status(404).send({ error: "Imagem não encontrada" });
    }

    let imageBuffer;
    let contentType = "image/jpeg";

    if (isEncryptedImage(actualFilename)) {
      console.log("🔓 Descriptografando imagem...");

      // 🔒 DESCRIPTOGRAFAR IMAGEM
      imageBuffer = decryptImage(imagePath);

      // Detectar tipo de conteúdo pelos magic bytes
      if (imageBuffer[0] === 0xff && imageBuffer[1] === 0xd8) {
        contentType = "image/jpeg";
      } else if (imageBuffer[0] === 0x89 && imageBuffer[1] === 0x50) {
        contentType = "image/png";
      }
    } else {
      // Imagem não criptografada (compatibilidade)
      imageBuffer = fs.readFileSync(imagePath);
    }

    // Headers de segurança para imagens
    reply.headers({
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=3600", // Cache por 1 hora
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
    });

    console.log("✅ Imagem servida com sucesso");
    return reply.send(imageBuffer);
  } catch (error) {
    console.error("❌ Erro ao servir imagem:", error);
    return reply.status(500).send({ error: "Erro interno do servidor" });
  }
};

export const checkVisitorImageExists = async (request, reply) => {
  try {
    const { filename } = request.params;
    const imagePath = path.join(__dirname, "../../uploads/visitors", filename);

    if (fs.existsSync(imagePath)) {
      reply.status(200).send({ exists: true });
    } else {
      reply.status(404).send({ exists: false });
    }
  } catch (error) {
    console.error("Erro ao verificar imagem:", error);
    return reply.status(500).send({ error: "Erro interno do servidor" });
  }
};

export const getPermissionarioImage = async (request, reply) => {
  try {
    const { filename } = request.params;

    const isEncrypted = isEncryptedImage(filename);
    const actualFilename = isEncrypted ? filename : `${filename}.encrypted`;

    const imagePath = path.join(
      __dirname,
      "../../uploads/permissionarios",
      actualFilename
    );

    if (!fs.existsSync(imagePath)) {
      return reply.status(404).send({ error: "Imagem não encontrada" });
    }

    let imageBuffer;
    let contentType = "image/jpeg";

    if (isEncryptedImage(actualFilename)) {
      // 🔒 DESCRIPTOGRAFAR IMAGEM
      imageBuffer = decryptImage(imagePath);

      if (imageBuffer[0] === 0xff && imageBuffer[1] === 0xd8) {
        contentType = "image/jpeg";
      } else if (imageBuffer[0] === 0x89 && imageBuffer[1] === 0x50) {
        contentType = "image/png";
      }
    } else {
      imageBuffer = fs.readFileSync(imagePath);
    }

    reply.headers({
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
    });

    return reply.send(imageBuffer);
  } catch (error) {
    console.error("❌ Erro ao servir imagem de permissionário:", error);
    return reply.status(500).send({ error: "Erro interno do servidor" });
  }
};
