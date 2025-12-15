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

// ========== FUNÇÕES PARA GERENCIAMENTO DE IMAGENS DO SISTEMA ==========

/**
 * Upload de imagem do sistema (logo ou background)
 */
/**
 * Upload de logo do sistema
 */
export const uploadLogo = async (request, reply) => {
  try {
    console.log("📥 Iniciando upload de LOGO...");

    const data = await request.file();

    if (!data) {
      return reply.status(400).send({
        success: false,
        error: "Nenhum arquivo enviado",
      });
    }

    if (!data.mimetype.startsWith("image/")) {
      return reply.status(400).send({
        success: false,
        error: "Apenas imagens são permitidas",
      });
    }

    const ext = path.extname(data.filename).toLowerCase();
    const allowedExts = [".jpg", ".jpeg", ".png", ".gif", ".webp"];

    if (!allowedExts.includes(ext)) {
      return reply.status(400).send({
        success: false,
        error: "Extensão não permitida. Use: jpg, jpeg, png, gif ou webp",
      });
    }

    const uploadDir = path.join(__dirname, "../../public/img");
    const fileName = `logo${ext}`;
    const filePath = path.join(uploadDir, fileName);

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Deletar logos antigas
    const existingFiles = fs.readdirSync(uploadDir).filter((f) => f.startsWith("logo"));
    existingFiles.forEach((file) => {
      try {
        fs.unlinkSync(path.join(uploadDir, file));
        console.log("🗑️ Logo antiga removida:", file);
      } catch (err) {
        console.error("❌ Erro ao deletar logo antiga:", err);
      }
    });

    const buffer = await data.toBuffer();
    fs.writeFileSync(filePath, buffer);

    console.log("✅ Logo salva com sucesso:", fileName);

    return reply.send({
      success: true,
      fileName: fileName,
      imagePath: `/system-images/${fileName}`,
      message: "Logo atualizada com sucesso",
    });
  } catch (error) {
    console.error("❌ Erro no upload da logo:", error);
    return reply.status(500).send({
      success: false,
      error: "Erro ao processar upload: " + error.message,
    });
  }
};

/**
 * Upload de background do sistema
 */
export const uploadBackground = async (request, reply) => {
  try {
    console.log("📥 Iniciando upload de BACKGROUND...");

    const data = await request.file();

    if (!data) {
      return reply.status(400).send({
        success: false,
        error: "Nenhum arquivo enviado",
      });
    }

    if (!data.mimetype.startsWith("image/")) {
      return reply.status(400).send({
        success: false,
        error: "Apenas imagens são permitidas",
      });
    }

    const ext = path.extname(data.filename).toLowerCase();
    const allowedExts = [".jpg", ".jpeg", ".png", ".gif", ".webp"];

    if (!allowedExts.includes(ext)) {
      return reply.status(400).send({
        success: false,
        error: "Extensão de arquivo não permitida. Use: jpg, jpeg, png, gif ou webp",
      });
    }

    // Definir diretórios e nome do arquivo
    const uploadDir = path.join(__dirname, "../../public/img");
    
    // Usar nome específico para background (bg-cover) e logo (logo)
    const fileName = imageType === "background" ? `bg-cover${ext}` : `logo${ext}`;
    const filePath = path.join(uploadDir, fileName);

    // Garantir que o diretório existe
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
      console.log("📁 Diretório criado:", uploadDir);
    }

    // Deletar arquivos antigos do mesmo tipo
    const prefix = imageType === "background" ? "bg-cover" : "logo";
    const existingFiles = fs
      .readdirSync(uploadDir)
      .filter((f) => f.startsWith(prefix));

    console.log(`🔍 Procurando arquivos com prefixo "${prefix}":`, existingFiles);

    existingFiles.forEach((file) => {
      try {
        fs.unlinkSync(path.join(uploadDir, file));
        console.log("🗑️ Arquivo antigo removido:", file);
      } catch (err) {
        console.error("❌ Erro ao deletar arquivo antigo:", err);
      }
    });

    // Salvar novo arquivo - ler o stream do arquivo
    const chunks = [];
    for await (const chunk of fileData.file) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    fs.writeFileSync(filePath, buffer);

    console.log("✅ Imagem salva com sucesso:", fileName);
    console.log("📍 Caminho completo:", filePath);

    return reply.send({
      success: true,
      fileName: fileName,
      imagePath: `/system-images/${fileName}`,
      message: `Imagem ${imageType} atualizada com sucesso`,
    });
  } catch (error) {
    console.error("❌ Erro no upload:", error);
    return reply.status(500).send({
      success: false,
      error: "Erro ao processar upload: " + error.message,
    });
  }
};

/**
 * Listar imagens atuais do sistema
 */
export const getCurrentSystemImages = async (request, reply) => {
  try {
    const imgDir = path.join(__dirname, "../../public/img");

    // Se o diretório não existe, retornar valores padrão
    if (!fs.existsSync(imgDir)) {
      return reply.send({
        logo: null,
        background: null,
        message: "Nenhuma imagem personalizada configurada",
      });
    }

    const files = fs.readdirSync(imgDir);

    const logo = files.find((f) => f.startsWith("logo"));
    const background = files.find((f) => f.startsWith("bg-cover"));

    return reply.send({
      logo: logo ? `/system-images/${logo}` : null,
      background: background ? `/system-images/${background}` : null,
    });
  } catch (error) {
    console.error("❌ Erro ao listar imagens:", error);
    return reply.status(500).send({
      success: false,
      error: "Erro ao carregar imagens",
    });
  }
};

/**
 * Resetar imagem para padrão (deletar imagem customizada)
 */
export const resetSystemImage = async (request, reply) => {
  try {
    const { type } = request.params;

    console.log("🔄 Resetando imagem:", type);

    // Validar tipo
    if (!["logo", "background"].includes(type)) {
      return reply.status(400).send({
        success: false,
        error: 'Tipo de imagem inválido. Use "logo" ou "background"',
      });
    }

    const imgDir = path.join(__dirname, "../../public/img");

    // Se o diretório não existe, não há o que fazer
    if (!fs.existsSync(imgDir)) {
      return reply.send({
        success: true,
        message: `Imagem ${type} já está no padrão`,
      });
    }

    // Buscar e deletar arquivos do tipo especificado
    const prefix = type === "background" ? "bg-cover" : "logo";
    const files = fs.readdirSync(imgDir).filter((f) => f.startsWith(prefix));

    let deletedCount = 0;
    files.forEach((file) => {
      try {
        fs.unlinkSync(path.join(imgDir, file));
        console.log("🗑️ Arquivo deletado:", file);
        deletedCount++;
      } catch (err) {
        console.error("❌ Erro ao deletar arquivo:", err);
      }
    });

    return reply.send({
      success: true,
      message: `Imagem ${type} restaurada para padrão`,
      filesDeleted: deletedCount,
    });
  } catch (error) {
    console.error("❌ Erro ao resetar imagem:", error);
    return reply.status(500).send({
      success: false,
      error: "Erro ao resetar imagem: " + error.message,
    });
  }
};

/**
 * Servir imagens do sistema (público)
 */
export const getSystemImage = async (request, reply) => {
  try {
    const { filename } = request.params;

    // Validar nome do arquivo para evitar path traversal
    if (filename.includes("..") || filename.includes("/")) {
      return reply.status(400).send({ error: "Nome de arquivo inválido" });
    }

    const imagePath = path.join(__dirname, "../../public/img", filename);

    console.log("🖼️ Servindo imagem do sistema:", imagePath);

    if (!fs.existsSync(imagePath)) {
      console.log("❌ Imagem não encontrada:", imagePath);
      return reply.status(404).send({ error: "Imagem não encontrada" });
    }

    // Detectar tipo de conteúdo baseado na extensão
    const ext = path.extname(filename).toLowerCase();
    let contentType = "image/jpeg";

    switch (ext) {
      case ".png":
        contentType = "image/png";
        break;
      case ".gif":
        contentType = "image/gif";
        break;
      case ".webp":
        contentType = "image/webp";
        break;
      case ".jpg":
      case ".jpeg":
      default:
        contentType = "image/jpeg";
    }

    const imageBuffer = fs.readFileSync(imagePath);

    reply.headers({
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400", // Cache por 24 horas
      "X-Content-Type-Options": "nosniff",
    });

    console.log("✅ Imagem do sistema servida com sucesso");
    return reply.send(imageBuffer);
  } catch (error) {
    console.error("❌ Erro ao servir imagem do sistema:", error);
    return reply.status(500).send({ error: "Erro interno do servidor" });
  }
};
