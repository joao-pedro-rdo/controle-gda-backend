import { prisma } from "../helpers/utils.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  encryptImage,
  getEncryptedPath,
  decryptImage,
} from "../helpers/imageEncryption.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, "../../uploads");
const permissionariosDir = path.join(uploadsDir, "permissionarios");

// Garantir que o diretório de uploads existe
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(permissionariosDir)) {
  fs.mkdirSync(permissionariosDir, { recursive: true });
}

export const index = async (req, reply) => {
  try {
    const allPermissionarios = await prisma.permissionario.findMany();
    reply.status(200).send(allPermissionarios);
  } catch (error) {
    console.log(error);
    reply.status(500).send("Erro ao buscar permissionários");
  }
};

export const getPermissionarioById = async (req, reply) => {
  try {
    const permissionario = await prisma.permissionario.findUnique({
      where: {
        id: +req.params.id,
      },
    });

    if (!permissionario) {
      reply.status(404).send("Permissionário não encontrado");
      return;
    }

    reply.status(200).send(permissionario);
  } catch (error) {
    console.log(error);
    reply.status(500).send("Erro ao buscar permissionário");
  }
};

export const getPermissionarioByCPF = async (req, reply) => {
  try {
    const permissionario = await prisma.permissionario.findFirst({
      where: {
        CPF: req.params.cpf,
      },
    });

    if (!permissionario) {
      reply.status(404).send("Permissionário não encontrado");
      return;
    }

    reply.status(200).send(permissionario);
  } catch (error) {
    console.log(error);
    reply.status(500).send("Erro ao buscar permissionário por CPF");
  }
};

export const createPermissionario = async (request, reply) => {
  try {
    console.log("📥 Iniciando createPermissionario...");

    // Verificar autenticação
    if (!request.user) {
      console.log("❌ Usuário não autenticado");
      return reply.status(401).send({ error: "Usuário não autenticado" });
    }

    console.log("✅ Usuário autenticado:", request.user.login);

    // Processar multipart
    const parts = request.parts();
    let imageFile = null;
    let formData = {};

    console.log("📁 Processando parts da requisição...");

    for await (const part of parts) {
      if (part.type === "file" && part.fieldname === "image") {
        console.log("🖼️ Arquivo de imagem encontrado:", {
          filename: part.filename,
          mimetype: part.mimetype,
        });
        imageFile = part;
        break;
      } else if (part.type !== "file") {
        formData[part.fieldname] = part.value;
        console.log(`📝 Campo: ${part.fieldname} = ${part.value}`);
      }
    }

    // Verificar se CPF já existe
    const existingPermissionario = await prisma.permissionario.findFirst({
      where: { CPF: formData.CPF },
    });

    if (existingPermissionario) {
      return reply.status(400).send({ error: "CPF já cadastrado" });
    }

    // Processar imagem se existir
    let imagePath = null;
    if (imageFile) {
      try {
        console.log("🔄 Processando imagem do permissionário...");

        const fileName = `permissionario_${Date.now()}.jpg`;
        const filePath = path.join(permissionariosDir, fileName);

        // Converter arquivo para buffer
        const buffer = await imageFile.toBuffer();
        console.log("📊 Buffer da imagem:", buffer.length, "bytes");

        // Salvar arquivo temporário
        await fs.promises.writeFile(filePath, buffer);
        console.log("💾 Arquivo temporário salvo:", filePath);

        // 🔒 CRIPTOGRAFAR IMAGEM
        console.log("🔒 Iniciando criptografia...");
        const encryptedPath = encryptImage(filePath);
        console.log("🔒 Imagem criptografada:", encryptedPath);

        // Definir caminho relativo para o banco
        imagePath = `/uploads/permissionarios/${fileName}.encrypted`;
        console.log("📝 ImagePath para banco:", imagePath);
      } catch (imageError) {
        console.error("❌ Erro no processamento da imagem:", imageError);
        imagePath = null;
      }
    }

    // Criar permissionário
    const permissionarioData = {
      completeName: formData.completeName,
      idNumber: formData.idNumber,
      CPF: formData.CPF,
      local: formData.local,
      carModel: formData.carModel || null,
      licensePlate: formData.licensePlate || null,
      color: formData.color || null,
      imagePath: imagePath,
    };

    console.log("📊 Dados do permissionário:", permissionarioData);

    const permissionario = await prisma.permissionario.create({
      data: permissionarioData,
    });

    console.log("✅ Permissionário criado:", {
      id: permissionario.id,
      name: permissionario.completeName,
      imagePath: permissionario.imagePath,
    });

    reply.status(201).send(permissionario);
  } catch (error) {
    console.error("❌ Erro geral no createPermissionario:", error);
    console.error("❌ Stack trace:", error.stack);

    if (!reply.sent) {
      reply.status(500).send({
        message: "Erro interno do servidor",
        error: error.message,
      });
    }
  }
};

export const updatePermissionario = async (request, reply) => {
  try {
    console.log("📥 Iniciando updatePermissionario...");

    const permissionarioId = +request.params.id;

    // Verificar se permissionário existe
    const existingPermissionario = await prisma.permissionario.findUnique({
      where: { id: permissionarioId },
    });

    if (!existingPermissionario) {
      return reply.status(404).send({ error: "Permissionário não encontrado" });
    }

    // Processar multipart
    const parts = request.parts();
    let imageFile = null;
    let formData = {};

    for await (const part of parts) {
      if (part.type === "file" && part.fieldname === "image") {
        imageFile = part;
        console.log("🖼️ Nova imagem encontrada");
      } else if (part.type !== "file") {
        formData[part.fieldname] = part.value;
      }
    }

    // Processar imagem
    let finalImagePath = existingPermissionario.imagePath; // Manter existente por padrão

    if (formData.removeImage === "true") {
      // Remover imagem
      if (existingPermissionario.imagePath) {
        const oldImagePath = path.join(
          __dirname,
          "../../",
          existingPermissionario.imagePath
        );
        if (fs.existsSync(oldImagePath)) {
          try {
            fs.unlinkSync(oldImagePath);
            console.log("🗑️ Imagem antiga removida");
          } catch (err) {
            console.error("❌ Erro ao remover imagem antiga:", err);
          }
        }
      }
      finalImagePath = null;
    } else if (imageFile) {
      // Nova imagem enviada
      try {
        // Remover imagem antiga se existir
        if (existingPermissionario.imagePath) {
          const oldImagePath = path.join(
            __dirname,
            "../../",
            existingPermissionario.imagePath
          );
          if (fs.existsSync(oldImagePath)) {
            try {
              fs.unlinkSync(oldImagePath);
              console.log("🗑️ Imagem antiga removida para substituição");
            } catch (err) {
              console.error("❌ Erro ao remover imagem antiga:", err);
            }
          }
        }

        // Processar nova imagem
        const fileName = `permissionario_${Date.now()}.jpg`;
        const filePath = path.join(permissionariosDir, fileName);

        const buffer = await imageFile.toBuffer();
        await fs.promises.writeFile(filePath, buffer);

        // Criptografar
        const encryptedPath = encryptImage(filePath);
        finalImagePath = `/uploads/permissionarios/${fileName}.encrypted`;

        console.log("✅ Nova imagem processada e criptografada");
      } catch (imageError) {
        console.error("❌ Erro ao processar nova imagem:", imageError);
        // Manter imagem existente em caso de erro
      }
    }
    // Se formData.keepExistingImage === "true", mantém finalImagePath como está

    // Atualizar permissionário
    const updatedData = {
      completeName: formData.completeName,
      idNumber: formData.idNumber,
      CPF: formData.CPF,
      local: formData.local,
      carModel: formData.carModel || null,
      licensePlate: formData.licensePlate || null,
      color: formData.color || null,
      imagePath: finalImagePath,
    };

    const permissionario = await prisma.permissionario.update({
      where: { id: permissionarioId },
      data: updatedData,
    });

    console.log("✅ Permissionário atualizado:", permissionario.id);
    reply.status(200).send(permissionario);
  } catch (error) {
    console.error("❌ Erro ao atualizar permissionário:", error);
    reply.status(500).send({
      message: "Erro interno do servidor",
      error: error.message,
    });
  }
};

export const deletePermissionario = async (req, reply) => {
  try {
    const permissionarioId = +req.params.id;

    // Buscar permissionário para obter caminho da imagem
    const permissionarioToDelete = await prisma.permissionario.findUnique({
      where: { id: permissionarioId },
    });

    if (!permissionarioToDelete) {
      return reply.status(404).send({ error: "Permissionário não encontrado" });
    }

    // Remover imagem se existir
    if (permissionarioToDelete.imagePath) {
      const imagePathToDelete = path.join(
        __dirname,
        "../../",
        permissionarioToDelete.imagePath
      );
      if (fs.existsSync(imagePathToDelete)) {
        try {
          fs.unlinkSync(imagePathToDelete);
          console.log("🗑️ Imagem removida:", imagePathToDelete);
        } catch (err) {
          console.error("❌ Erro ao remover imagem:", err);
        }
      }
    }

    const deletedPermissionario = await prisma.permissionario.delete({
      where: { id: permissionarioId },
    });

    reply.status(200).send(deletedPermissionario);
  } catch (error) {
    console.log(error);
    reply.status(500).send("Erro ao excluir permissionário");
  }
};

// Função para servir imagens de permissionários (igual à de entries)
export const getPermissionarioImage = async (request, reply) => {
  try {
    const { filename } = request.params;

    console.log("🖼️ Solicitação de imagem de permissionário:", filename);

    let imagePath;
    let isEncrypted = false;

    const encryptedPath = path.join(permissionariosDir, filename);
    const originalPath = path.join(
      permissionariosDir,
      filename.replace(".encrypted", "")
    );

    if (fs.existsSync(encryptedPath) && filename.endsWith(".encrypted")) {
      imagePath = encryptedPath;
      isEncrypted = true;
    } else if (fs.existsSync(originalPath)) {
      imagePath = originalPath;
      isEncrypted = false;
    } else {
      return reply.status(404).send({ error: "Imagem não encontrada" });
    }

    let imageBuffer;
    let contentType = "image/jpeg";

    if (isEncrypted) {
      try {
        imageBuffer = decryptImage(imagePath);

        if (imageBuffer[0] === 0xff && imageBuffer[1] === 0xd8) {
          contentType = "image/jpeg";
        } else if (imageBuffer[0] === 0x89 && imageBuffer[1] === 0x50) {
          contentType = "image/png";
        }
      } catch (decryptError) {
        console.error("❌ Erro na descriptografia:", decryptError);
        return reply
          .status(500)
          .send({ error: "Erro ao descriptografar imagem" });
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
