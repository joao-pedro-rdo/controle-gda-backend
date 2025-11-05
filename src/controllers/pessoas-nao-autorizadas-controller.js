// Arquivo: back/src/controllers/pessoas-nao-autorizadas-controller.js
import { prisma } from "../helpers/utils.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { encryptImage, decryptImage } from "../helpers/imageEncryption.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, "../../uploads");
const pessoasNaoAutorizadasDir = path.join(
  uploadsDir,
  "pessoas-nao-autorizadas"
);

// Garantir que o diretório existe
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(pessoasNaoAutorizadasDir)) {
  fs.mkdirSync(pessoasNaoAutorizadasDir, { recursive: true });
}

// Listar todas as pessoas não autorizadas
export const index = async (req, reply) => {
  try {
    console.log("📋 Listando pessoas não autorizadas...");

    const pessoas = await prisma.pessoaNaoAutorizada.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    console.log(`✅ ${pessoas.length} pessoas não autorizadas encontradas`);
    reply.status(200).send(pessoas);
  } catch (error) {
    console.error("❌ Erro ao listar pessoas não autorizadas:", error);
    reply.status(500).send({
      error: "Erro ao buscar pessoas não autorizadas",
      details: error.message,
    });
  }
};

// Buscar pessoa não autorizada por ID
export const getById = async (req, reply) => {
  try {
    const { id } = req.params;

    console.log(`🔍 Buscando pessoa não autorizada ID: ${id}`);

    const pessoa = await prisma.pessoaNaoAutorizada.findUnique({
      where: {
        id: parseInt(id),
      },
    });

    if (!pessoa) {
      console.log(`❌ Pessoa não autorizada ID ${id} não encontrada`);
      return reply.status(404).send({ error: "Pessoa não encontrada" });
    }

    console.log(`✅ Pessoa não autorizada encontrada: ${pessoa.nome}`);
    reply.status(200).send(pessoa);
  } catch (error) {
    console.error("❌ Erro ao buscar pessoa não autorizada:", error);
    reply.status(500).send({
      error: "Erro ao buscar pessoa não autorizada",
      details: error.message,
    });
  }
};

// Criar nova pessoa não autorizada
export const create = async (request, reply) => {
  try {
    console.log("📥 Iniciando cadastro de pessoa não autorizada...");

    // Verificar autenticação
    if (!request.user) {
      console.log("❌ Usuário não autenticado");
      return reply.status(401).send({ error: "Usuário não autenticado" });
    }

    console.log(
      "✅ Usuário autenticado:",
      request.user.login,
      "- Role:",
      request.user.role
    );

    // Processar multipart
    const parts = request.parts();
    let imageFile = null;
    let formData = {};

    console.log("📁 Processando dados multipart...");

    for await (const part of parts) {
      if (part.type === "file" && part.fieldname === "image") {
        console.log("🖼️ Imagem encontrada:", {
          filename: part.filename,
          mimetype: part.mimetype,
          encoding: part.encoding,
        });
        imageFile = part;
        break;
      } else if (part.type !== "file") {
        formData[part.fieldname] = part.value;
        console.log(`📝 Campo: ${part.fieldname} = ${part.value}`);
      }
    }

    console.log("📋 Dados recebidos:", formData);

    // Validação de campos obrigatórios
    if (!formData.nome || !formData.CPF) {
      return reply.status(400).send({
        error: "Campos obrigatórios não preenchidos",
        required: ["nome", "CPF"],
      });
    }

    // Verificar se CPF já existe
    const existingPessoa = await prisma.pessoaNaoAutorizada.findUnique({
      where: { CPF: formData.CPF },
    });

    if (existingPessoa) {
      return reply.status(409).send({
        error: "CPF já cadastrado",
        details: `CPF ${formData.CPF} já está registrado no sistema`,
      });
    }

    // Processar imagem se fornecida
    let imagePath = null;
    if (imageFile) {
      try {
        console.log("🔄 Processando imagem...");

        const fileName = `pessoa_nao_autorizada_${Date.now()}.jpg`;
        const filePath = path.join(pessoasNaoAutorizadasDir, fileName);

        console.log("📍 Salvando imagem em:", filePath);

        // Converter para buffer e salvar
        const buffer = await imageFile.toBuffer();
        console.log("📊 Tamanho da imagem:", buffer.length, "bytes");

        await fs.promises.writeFile(filePath, buffer);
        console.log("💾 Arquivo temporário salvo");

        // Criptografar imagem
        console.log("🔒 Criptografando imagem...");
        const encryptedPath = encryptImage(filePath);
        console.log("🔒 Imagem criptografada:", encryptedPath);

        // Caminho relativo para o banco
        imagePath = `/uploads/pessoas-nao-autorizadas/${fileName}.encrypted`;
        console.log("📝 ImagePath para banco:", imagePath);
      } catch (imageError) {
        console.error("❌ Erro no processamento da imagem:", imageError);
        // Continuar sem imagem se houver erro
        imagePath = null;
      }
    } else {
      console.log("⚠️ Nenhuma imagem fornecida");
    }

    // Criar registro no banco
    console.log("💾 Salvando no banco de dados...");
    const pessoa = await prisma.pessoaNaoAutorizada.create({
      data: {
        nome: formData.nome,
        imagePath: imagePath,
        identidade: formData.identidade || null,
        CPF: formData.CPF,
        observacao: formData.observacao || null,
      },
    });

    console.log("✅ Pessoa não autorizada criada:", {
      id: pessoa.id,
      nome: pessoa.nome,
      CPF: pessoa.CPF,
      imagePath: pessoa.imagePath,
    });

    reply.status(201).send({
      message: "Pessoa não autorizada cadastrada com sucesso",
      pessoa: pessoa,
    });
  } catch (error) {
    console.error("❌ Erro ao criar pessoa não autorizada:", error);

    if (!reply.sent) {
      reply.status(500).send({
        error: "Erro interno do servidor",
        details: error.message,
      });
    }
  }
};

// Atualizar pessoa não autorizada
export const update = async (request, reply) => {
  try {
    const { id } = request.params;

    console.log(`📝 Atualizando pessoa não autorizada ID: ${id}`);

    // Verificar se pessoa existe
    const pessoaExistente = await prisma.pessoaNaoAutorizada.findUnique({
      where: { id: parseInt(id) },
    });

    if (!pessoaExistente) {
      return reply.status(404).send({ error: "Pessoa não encontrada" });
    }

    // Processar multipart
    const parts = request.parts();
    let imageFile = null;
    let formData = {};

    for await (const part of parts) {
      if (part.type === "file" && part.fieldname === "image") {
        imageFile = part;
        console.log("🖼️ Nova imagem fornecida");
      } else if (part.type !== "file") {
        formData[part.fieldname] = part.value;
      }
    }

    // Processar nova imagem se fornecida
    let imagePath = pessoaExistente.imagePath; // Manter imagem atual por padrão

    if (imageFile) {
      try {
        console.log("🔄 Processando nova imagem...");

        // Remover imagem anterior se existir
        if (pessoaExistente.imagePath) {
          const oldImagePath = path.join(
            __dirname,
            "../..",
            pessoaExistente.imagePath
          );
          if (fs.existsSync(oldImagePath)) {
            fs.unlinkSync(oldImagePath);
            console.log("🗑️ Imagem anterior removida");
          }
        }

        const fileName = `pessoa_nao_autorizada_${Date.now()}.jpg`;
        const filePath = path.join(pessoasNaoAutorizadasDir, fileName);

        const buffer = await imageFile.toBuffer();
        await fs.promises.writeFile(filePath, buffer);

        const encryptedPath = encryptImage(filePath);
        imagePath = `/uploads/pessoas-nao-autorizadas/${fileName}.encrypted`;

        console.log("✅ Nova imagem processada:", imagePath);
      } catch (imageError) {
        console.error("❌ Erro no processamento da nova imagem:", imageError);
        // Manter imagem atual se houver erro
      }
    }

    // Atualizar no banco
    const pessoaAtualizada = await prisma.pessoaNaoAutorizada.update({
      where: { id: parseInt(id) },
      data: {
        nome: formData.nome || pessoaExistente.nome,
        imagePath: imagePath,
        identidade:
          formData.identidade !== undefined
            ? formData.identidade
            : pessoaExistente.identidade,
        CPF: formData.CPF || pessoaExistente.CPF,
        observacao:
          formData.observacao !== undefined
            ? formData.observacao
            : pessoaExistente.observacao,
      },
    });

    console.log("✅ Pessoa não autorizada atualizada:", pessoaAtualizada.nome);

    reply.status(200).send({
      message: "Pessoa não autorizada atualizada com sucesso",
      pessoa: pessoaAtualizada,
    });
  } catch (error) {
    console.error("❌ Erro ao atualizar pessoa não autorizada:", error);
    reply.status(500).send({
      error: "Erro ao atualizar pessoa não autorizada",
      details: error.message,
    });
  }
};

// Remover pessoa não autorizada
export const remove = async (req, reply) => {
  try {
    const { id } = req.params;

    console.log(`🗑️ Removendo pessoa não autorizada ID: ${id}`);

    // Buscar pessoa para obter caminho da imagem
    const pessoa = await prisma.pessoaNaoAutorizada.findUnique({
      where: { id: parseInt(id) },
    });

    if (!pessoa) {
      return reply.status(404).send({ error: "Pessoa não encontrada" });
    }

    // Remover imagem se existir
    if (pessoa.imagePath) {
      const imagePath = path.join(__dirname, "../..", pessoa.imagePath);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
        console.log("🗑️ Imagem removida:", imagePath);
      }
    }

    // Remover do banco
    await prisma.pessoaNaoAutorizada.delete({
      where: { id: parseInt(id) },
    });

    console.log(`✅ Pessoa não autorizada removida: ${pessoa.nome}`);

    reply.status(200).send({
      message: "Pessoa não autorizada removida com sucesso",
      removedPerson: {
        id: pessoa.id,
        nome: pessoa.nome,
        CPF: pessoa.CPF,
      },
    });
  } catch (error) {
    console.error("❌ Erro ao remover pessoa não autorizada:", error);
    reply.status(500).send({
      error: "Erro ao remover pessoa não autorizada",
      details: error.message,
    });
  }
};

// Servir imagem de pessoa não autorizada
export const getImage = async (request, reply) => {
  try {
    const { filename } = request.params;

    console.log("🖼️ Solicitação de imagem pessoa não autorizada:", filename);

    let imagePath;
    let isEncrypted = false;

    // Tentar encontrar versão criptografada primeiro
    const encryptedPath = path.join(
      __dirname,
      "../../uploads/pessoas-nao-autorizadas",
      filename
    );
    const originalPath = path.join(
      __dirname,
      "../../uploads/pessoas-nao-autorizadas",
      filename.replace(".encrypted", "")
    );

    if (fs.existsSync(encryptedPath) && filename.endsWith(".encrypted")) {
      imagePath = encryptedPath;
      isEncrypted = true;
      console.log("🔒 Arquivo criptografado encontrado");
    } else if (fs.existsSync(originalPath)) {
      imagePath = originalPath;
      isEncrypted = false;
      console.log("📁 Arquivo não criptografado encontrado");
    } else {
      console.log("❌ Imagem não encontrada:", filename);
      return reply.status(404).send({ error: "Imagem não encontrada" });
    }

    let imageBuffer;
    let contentType = "image/jpeg";

    if (isEncrypted) {
      try {
        console.log("🔓 Descriptografando imagem...");
        imageBuffer = decryptImage(imagePath);

        // Detectar tipo de conteúdo
        if (imageBuffer[0] === 0xff && imageBuffer[1] === 0xd8) {
          contentType = "image/jpeg";
        } else if (imageBuffer[0] === 0x89 && imageBuffer[1] === 0x50) {
          contentType = "image/png";
        }

        console.log("✅ Imagem descriptografada com sucesso");
      } catch (decryptError) {
        console.error("❌ Erro na descriptografia:", decryptError);
        return reply
          .status(500)
          .send({ error: "Erro ao descriptografar imagem" });
      }
    } else {
      imageBuffer = fs.readFileSync(imagePath);
      console.log("📁 Imagem não criptografada carregada");
    }

    // Headers de segurança
    reply.headers({
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=3600",
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
