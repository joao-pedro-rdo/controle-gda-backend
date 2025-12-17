import { prisma } from "../helpers/utils.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { verifyS2Role, verifyGuardaRole } from "../middleware/auth.js";
import {
  encryptImage,
  getEncryptedPath,
  decryptImage,
} from "../helpers/imageEncryption.js";
// 📊 Importar métricas do Prometheus
import {
  incrementEntryCounter,
  incrementExitCounter,
  incrementScheduledEntry,
  recordStayDuration,
  incrementImageUpload,
} from "../helpers/prometheus.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, "../../uploads");
const visitorsDir = path.join(uploadsDir, "visitors");

// Garantir que o diretório de uploads e o subdiretório visitors existem
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(visitorsDir)) {
  fs.mkdirSync(visitorsDir, { recursive: true });
}

export const index = async (req, reply) => {
  try {
    const allEntries = await prisma.entry.findMany();
    reply.status(200).send(allEntries);
  } catch (error) {
    console.log(error);
    reply.status(500).send("Erro ao buscar entradas");
  }
};

export const getEntriesByDate = async (req, reply) => {
  const { initialDate, finalDate, includeScheduled } = req.body;
  try {
    let whereClause = {
      time: {
        gte: new Date(initialDate),
        lt: new Date(finalDate),
      },
    };

    // Por padrão, excluir agendamentos dos relatórios
    if (!includeScheduled) {
      whereClause.isScheduled = false;
    }

    const entries = await prisma.entry.findMany({
      where: whereClause,
      orderBy: {
        id: "asc",
      },
    });

    if (!entries) {
      reply.status(404).send("Não há movimento registrado para o dia");
    }
    reply.status(200).send(entries);
  } catch (error) {
    console.log(error);
    reply.status(500).send("Erro ao buscar entradas por data");
  }
};

export const createEntry = async (request, reply) => {
  try {
    console.log("📥 Iniciando createEntry...");

    // Verificar auth
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
        console.log("🖼️ Arquivo de imagem encontrado");
        imageFile = part;
        break;
      } else if (part.type !== "file") {
        formData[part.fieldname] = part.value;
        console.log(`📝 Campo: ${part.fieldname} = ${part.value}`);
      }
    }

    console.log("📋 Form data completo:", formData);

    // Verificar permissões
    const isScheduled = formData.isScheduled === "true";
    const allowedRoles = ["Guarda", "S2", "SFPC"];

    if (isScheduled) {
      const schedulingRoles = ["S2", "SFPC"];
      if (!schedulingRoles.includes(request.user.role)) {
        return reply
          .status(403)
          .send({ error: "Permissão negada para agendamentos" });
      }
    } else {
      if (!allowedRoles.includes(request.user.role)) {
        return reply
          .status(403)
          .send({ error: "Permissão negada para entradas" });
      }
    }

    // --- VALIDAÇÕES ANTES DE CRIAR ---
    if (formData.isPermissionario === "true" && !formData.CPF) {
      return reply.status(400).send({
        error: "CPF é obrigatório para permissionários",
      });
    }

    // 🔧 CORREÇÃO: Inicializar imagePath antes de usar
    let imagePath = null;

    // 🎯 PARA SAÍDAS: Buscar imagem da entrada original
    if (formData.type === "Saída") {
      console.log(
        "🔍 Processando saída - buscando imagem da entrada original..."
      );

      try {
        // Buscar entrada original pelo nome, data e tipo de pessoa
        const whereClause = {
          name: formData.name,
          type: "Entrada",
          exited: false, // Ainda não saiu
        };

        if (formData.isVisitor === "true") {
          whereClause.isVisitor = true;
        } else if (formData.isPermissionario === "true") {
          whereClause.isPermissionario = true;
        }

        const originalEntry = await prisma.entry.findFirst({
          where: whereClause,
          orderBy: {
            time: "desc", // Pegar a entrada mais recente
          },
        });

        if (originalEntry && originalEntry.imagePath) {
          imagePath = originalEntry.imagePath;
          console.log("🖼️ Imagem da entrada original encontrada:", imagePath);
        } else {
          console.log("⚠️ Entrada original não encontrada ou sem imagem");
        }
      } catch (searchError) {
        console.error("❌ Erro ao buscar entrada original:", searchError);
      }
    }

    // Validação para visitantes - só verificar se não é saída e não é permissionário
    if (
      formData.isVisitor === "true" &&
      !imageFile &&
      !imagePath &&
      formData.type !== "Saída"
    ) {
      return reply.status(400).send({
        error: "Imagem é obrigatória para visitantes (exceto saídas)",
      });
    }

    // --- PROCESSAMENTO DE IMAGEM ---

    // 🎯 SE FOR PERMISSIONÁRIO, BUSCAR IMAGEM EXISTENTE
    if (formData.isPermissionario === "true" && formData.CPF) {
      try {
        console.log("👤 Buscando dados do permissionário:", formData.CPF);

        const permissionario = await prisma.permissionario.findFirst({
          where: { CPF: formData.CPF },
        });

        if (permissionario && permissionario.imagePath) {
          console.log(
            "🖼️ Imagem do permissionário encontrada:",
            permissionario.imagePath
          );

          // Usar a imagem existente do permissionário
          imagePath = permissionario.imagePath;

          // Atualizar outros campos com dados do permissionário se não fornecidos
          if (!formData.name) formData.name = permissionario.completeName;
          if (!formData.idNumber) formData.idNumber = permissionario.idNumber;
          if (!formData.licensePlate)
            formData.licensePlate = permissionario.licensePlate || "N/A";
          if (!formData.carModel)
            formData.carModel = permissionario.carModel || "N/A";
          if (!formData.color) formData.color = permissionario.color || "N/A";
          if (!formData.target) formData.target = permissionario.local || "";

          console.log("✅ Dados do permissionário aplicados à entrada");
        } else {
          console.log("⚠️ Permissionário não encontrado ou sem imagem");
        }
      } catch (permissionarioError) {
        console.error("❌ Erro ao buscar permissionário:", permissionarioError);
        // Continuar sem imagem específica
      }
    }

    // Se não é permissionário OU não foi encontrada imagem do permissionário, processar imagem enviada
    if (!imagePath && imageFile) {
      try {
        console.log("🔄 Processando imagem enviada...");

        const fileName = `visitor_${Date.now()}.jpg`;
        const filePath = path.join(visitorsDir, fileName);

        const buffer = await imageFile.toBuffer();
        await fs.promises.writeFile(filePath, buffer);

        // Criptografar imagem
        const encryptedPath = encryptImage(filePath);
        imagePath = `/uploads/visitors/${fileName}.encrypted`;

        console.log("✅ Nova imagem processada e criptografada");
      } catch (imageError) {
        console.error("❌ Erro no processamento da imagem:", imageError);
        imagePath = null;
      }
    }

    // --- CRIAÇÃO DA ENTRADA ---
    console.log("💾 Criando entrada no banco de dados...");
    const entryData = {
      type: formData.type || "Entrada",
      isVisitor: formData.isVisitor === "true",
      isPermissionario: formData.isPermissionario === "true",
      isScheduled: isScheduled,
      name: formData.name,
      idNumber: formData.idNumber || "",
      licensePlate: formData.licensePlate,
      carModel: formData.carModel,
      time: new Date(),
      target: formData.target,
      contactPerson: formData.contactPerson,
      color: formData.color || "",
      phoneNumber: formData.phoneNumber || "",
      imagePath: imagePath, // Agora busca da entrada original para saídas
    };

    console.log("📊 Dados da entrada:", entryData);

    const entry = await prisma.entry.create({
      data: entryData,
    });

    console.log("✅ Entrada criada:", {
      id: entry.id,
      name: entry.name,
      type: entry.type,
      isPermissionario: entry.isPermissionario,
      imagePath: entry.imagePath,
    });

    // 📊 PROMETHEUS: Registrar métrica de entrada
    let entryType = "visitor"; // padrão
    
    if (formData.isPermissionario === "true") {
      entryType = "permissionario";
    } else if (formData.isMilitar === "true") {
      entryType = "militar";
    } else if (formData.isVisitor === "true") {
      entryType = "visitor";
    }
    
    // Só incrementar se for ENTRADA, não saída
    if (formData.type !== "Saída") {
      incrementEntryCounter(entryType, isScheduled, "success");
      console.log(`📊 [Prometheus] Entrada registrada: type=${entryType}, scheduled=${isScheduled}`);
    }

    // Se houver imagem, registrar upload
    if (imageFile) {
      incrementImageUpload("visitor", "success", imageFile.file?.bytesRead || 0);
    }

    reply.status(201).send({
      message: "Entrada registrada com sucesso",
      entry: entry,
    });
  } catch (error) {
    console.error("❌ Erro geral no createEntry:", error);

    if (!reply.sent) {
      reply.status(500).send({
        message: "Erro interno do servidor",
        error: error.message,
      });
    }
  }
};
export const updateEntry = async (req, reply) => {
  try {
    const { exited, id } = req.body;
    
    // Buscar entrada antes de atualizar
    const entry = await prisma.entry.findUnique({
      where: { id }
    });
    
    const updatedEntry = await prisma.entry.update({
      where: {
        id,
      },
      data: {
        exited,
      },
    });
    
    // 📊 PROMETHEUS: Registrar saída se exited = true
    if (exited && entry && !entry.exited) {
      let exitType = "visitor";
      if (entry.isPermissionario) {
        exitType = "permissionario";
      } else if (entry.isMilitar) {
        exitType = "militar";
      }
      
      incrementExitCounter(exitType);
      
      // Calcular tempo de permanência se houver data de entrada
      if (entry.time) {
        const stayHours = (Date.now() - new Date(entry.time).getTime()) / (1000 * 60 * 60);
        recordStayDuration(exitType, stayHours);
      }
      
      console.log(`📊 [Prometheus] Saída registrada: type=${exitType}`);
    }
    
    reply.status(201).send(updatedEntry);
  } catch (error) {
    console.error(error);
    reply.status(500).send("Erro ao atualizar entrada");
  }
};

export const getEntryById = async (req, reply) => {
  try {
    const { id } = req.params;
    const entry = await prisma.entry.findUnique({
      where: {
        id: parseInt(id),
      },
    });

    if (!entry) {
      return reply.status(404).send("Entrada não encontrada");
    }

    reply.status(200).send(entry);
  } catch (error) {
    console.error(error);
    reply.status(500).send("Erro ao buscar entrada");
  }
};

export const handlePermissionarioEntry = async (permissionario) => {
  try {
    // Buscar os dados completos do permissionário incluindo imagePath
    const permissionarioCompleto = await prisma.permissionario.findUnique({
      where: { CPF: permissionario.CPF },
    });

    const data = {
      type: "Entrada",
      isVisitor: false,
      isPermissionario: true,
      name: permissionarioCompleto.completeName,
      idNumber: permissionarioCompleto.idNumber,
      licensePlate: permissionarioCompleto.licensePlate || "N/A",
      carModel: permissionarioCompleto.carModel || "N/A",
      color: permissionarioCompleto.color || "N/A",
      imagePath: permissionarioCompleto.imagePath, // Incluir a foto do permissionário
      CPF: permissionarioCompleto.CPF,
    };

    const entry = await prisma.entry.create({ data });
    return entry;
  } catch (error) {
    console.error("Erro ao registrar entrada de permissionário:", error);
    throw error;
  }
};

export const getScheduledEntries = async (req, reply) => {
  try {
    const { date } = req.query; // Data opcional para filtrar agendamentos

    let whereClause = {
      isScheduled: true,
      type: "Entrada", // Agendamentos são sempre do tipo "Entrada"
    };

    // Se uma data específica foi fornecida, filtrar por essa data
    if (date) {
      const startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 1); // Próximo dia

      whereClause.scheduledDate = {
        gte: startDate,
        lt: endDate,
      };
    }

    const scheduledEntries = await prisma.entry.findMany({
      where: whereClause,
      orderBy: {
        scheduledDate: "asc",
      },
    });

    reply.status(200).send(scheduledEntries);
  } catch (error) {
    console.log(error);
    reply.status(500).send("Erro ao buscar agendamentos");
  }
};

export const getScheduledEntriesByDateRange = async (req, reply) => {
  try {
    const { initialDate, finalDate } = req.body;

    const scheduledEntries = await prisma.entry.findMany({
      where: {
        isScheduled: true,
        scheduledDate: {
          gte: new Date(initialDate),
          lt: new Date(finalDate),
        },
      },
      orderBy: {
        scheduledDate: "asc",
      },
    });

    reply.status(200).send(scheduledEntries);
  } catch (error) {
    console.log(error);
    reply.status(500).send("Erro ao buscar agendamentos por período");
  }
};

// Função para confirmar agendamento (transformar em entrada real)
export const confirmScheduledEntry = async (request, reply) => {
  try {
    console.log("✅ Iniciando confirmScheduledEntry...");

    // Verificar auth
    if (!request.user) {
      console.log("❌ Usuário não autenticado");
      return reply.status(401).send({ error: "Usuário não autenticado" });
    }

    console.log("✅ Usuário autenticado:", request.user.login);

    // Verificar permissões - apenas Guardas podem confirmar agendamentos
    if (!["Guarda"].includes(request.user.role)) {
      return reply.status(403).send({
        error: "Permissão negada - apenas Guardas podem confirmar agendamentos",
      });
    }

    const { id } = request.params;

    // 🔧 PROCESSAR MULTIPART DATA (igual ao createEntry)
    const parts = request.parts();
    let imageFile = null;
    let formData = {};

    console.log("📁 Processando parts da requisição de confirmação...");

    for await (const part of parts) {
      if (part.type === "file" && part.fieldname === "image") {
        console.log("🖼️ Arquivo de imagem encontrado");
        imageFile = part;
        break;
      } else if (part.type !== "file") {
        formData[part.fieldname] = part.value;
        console.log(`📝 Campo: ${part.fieldname} = ${part.value}`);
      }
    }

    console.log("📋 Form data da confirmação:", formData);

    // Buscar o agendamento original
    const scheduledEntry = await prisma.entry.findUnique({
      where: { id: parseInt(id) },
    });

    if (!scheduledEntry) {
      return reply.status(404).send({
        error: "Agendamento não encontrado",
      });
    }

    if (!scheduledEntry.isScheduled) {
      return reply.status(400).send({
        error: "Esta entrada não é um agendamento",
      });
    }

    // Validação da imagem
    if (!imageFile) {
      return reply.status(400).send({
        error: "Imagem é obrigatória para confirmar agendamento",
      });
    }

    // --- PROCESSAMENTO DE IMAGEM ---
    let imagePath = null;

    try {
      console.log("🔄 Processando imagem de confirmação...");

      const fileName = `visitor_${Date.now()}.jpg`;
      const filePath = path.join(visitorsDir, fileName);

      const buffer = await imageFile.toBuffer();
      await fs.promises.writeFile(filePath, buffer);

      // Criptografar imagem
      const encryptedPath = encryptImage(filePath);
      imagePath = `/uploads/visitors/${fileName}.encrypted`;

      console.log("✅ Imagem processada e criptografada:", imagePath);
    } catch (imageError) {
      console.error("❌ Erro no processamento da imagem:", imageError);
      return reply.status(500).send({
        error: "Erro no processamento da imagem",
      });
    }

    // --- ATUALIZAR AGENDAMENTO PARA ENTRADA CONFIRMADA ---
    console.log("💾 Confirmando agendamento...");

    const updatedEntry = await prisma.entry.update({
      where: { id: parseInt(id) },
      data: {
        isScheduled: false, // ← Não é mais agendamento
        time: new Date(), // ← Horário real da entrada
        imagePath: imagePath, // ← Adicionar imagem capturada
        // Manter todos os outros dados do agendamento original
      },
    });

    console.log("✅ Agendamento confirmado:", {
      id: updatedEntry.id,
      name: updatedEntry.name,
      time: updatedEntry.time,
      imagePath: updatedEntry.imagePath,
    });

    // 📊 PROMETHEUS: Registrar confirmação de agendamento
    incrementScheduledEntry("confirmed");

    reply.status(200).send({
      message: "Agendamento confirmado com sucesso",
      entry: updatedEntry,
    });
  } catch (error) {
    console.error("❌ Erro geral no confirmScheduledEntry:", error);

    if (!reply.sent) {
      reply.status(500).send({
        message: "Erro interno do servidor",
        error: error.message,
      });
    }
  }
};
export const createExit = async (request, reply) => {
  try {
    console.log("🚪 Iniciando createExit...");

    // Verificar auth
    if (!request.user) {
      console.log("❌ Usuário não autenticado");
      return reply.status(401).send({ error: "Usuário não autenticado" });
    }

    console.log("✅ Usuário autenticado:", request.user.login);

    // Verificar permissões - apenas Guardas podem registrar saídas
    if (!["Guarda", "S2", "SFPC"].includes(request.user.role)) {
      return reply.status(403).send({ error: "Permissão negada para saídas" });
    }

    const {
      entryId,
      name,
      idNumber,
      phoneNumber,
      licensePlate,
      carModel,
      color,
      target,
      contactPerson,
      isVisitor,
      isPermissionario,
      imagePath, // ← Receber imagePath diretamente
      CPF,
    } = request.body;

    console.log("📋 Dados recebidos para saída:", {
      entryId,
      name,
      isVisitor,
      isPermissionario,
      imagePath,
    });

    // Validações básicas
    if (!entryId || !name) {
      return reply.status(400).send({
        error: "ID da entrada e nome são obrigatórios",
      });
    }

    // Verificar se a entrada original existe e não foi marcada como saída
    const originalEntry = await prisma.entry.findUnique({
      where: { id: parseInt(entryId) },
    });

    if (!originalEntry) {
      return reply.status(404).send({
        error: "Entrada original não encontrada",
      });
    }

    if (originalEntry.exited) {
      return reply.status(400).send({
        error: "Esta entrada já foi marcada como saída",
      });
    }

    // --- CRIAÇÃO DO REGISTRO DE SAÍDA ---
    console.log("💾 Criando registro de saída no banco de dados...");

    const exitData = {
      type: "Saída",
      isVisitor: isVisitor === true || isVisitor === "true",
      isPermissionario:
        isPermissionario === true || isPermissionario === "true",
      isScheduled: false,
      name: name,
      idNumber: idNumber || "",
      licensePlate: licensePlate || "",
      carModel: carModel || "",
      time: new Date(),
      target: target || "",
      contactPerson: contactPerson || "",
      color: color || "",
      phoneNumber: phoneNumber || "",
      imagePath: imagePath, // ← Usar imagePath recebido diretamente
    };

    console.log("📊 Dados da saída:", exitData);

    const exitEntry = await prisma.entry.create({
      data: exitData,
    });

    // Marcar entrada original como "exited"
    await prisma.entry.update({
      where: { id: parseInt(entryId) },
      data: { exited: true },
    });

    console.log("✅ Saída registrada:", {
      id: exitEntry.id,
      name: exitEntry.name,
      type: exitEntry.type,
      imagePath: exitEntry.imagePath,
    });

    // 📊 PROMETHEUS: Registrar métrica de saída
    const exitType = isPermissionario === true || isPermissionario === "true"
      ? "permissionario"
      : "visitor";
    incrementExitCounter(exitType);

    // Calcular tempo de permanência (se possível)
    if (entryId) {
      try {
        const originalEntry = await prisma.entry.findUnique({
          where: { id: parseInt(entryId) },
        });
        if (originalEntry && originalEntry.time) {
          const stayTime = (new Date() - new Date(originalEntry.time)) / (1000 * 60 * 60); // em horas
          recordStayDuration(exitType, stayTime);
        }
      } catch (err) {
        console.error("❌ Erro ao calcular tempo de permanência:", err.message);
      }
    }

    reply.status(201).send({
      message: "Saída registrada com sucesso",
      exit: exitEntry,
      originalEntryUpdated: true,
    });
  } catch (error) {
    console.error("❌ Erro geral no createExit:", error);

    if (!reply.sent) {
      reply.status(500).send({
        message: "Erro interno do servidor",
        error: error.message,
      });
    }
  }
};

// Adicionar esta nova função no entries-controller.js

export const createScheduledEntry = async (request, reply) => {
  try {
    console.log("📅 Iniciando createScheduledEntry...");

    // Verificar auth
    if (!request.user) {
      console.log("❌ Usuário não autenticado");
      return reply.status(401).send({ error: "Usuário não autenticado" });
    }

    console.log("✅ Usuário autenticado:", request.user.login);

    // Verificar permissões - apenas S2 e SFPC podem agendar
    if (!["S2", "SFPC"].includes(request.user.role)) {
      return reply.status(403).send({
        error: "Permissão negada para agendamentos - apenas S2/SFPC",
      });
    }

    const {
      name,
      idNumber,
      phoneNumber,
      licensePlate,
      carModel,
      color,
      contactPerson,
      target,
      scheduledDate,
    } = request.body;

    console.log("📋 Dados do agendamento:", {
      name,
      idNumber,
      scheduledDate,
    });

    // Validações básicas
    if (!name || !idNumber || !scheduledDate) {
      return reply.status(400).send({
        error: "Nome, identidade e data de agendamento são obrigatórios",
      });
    }

    // Verificar se a data é futura
    const agendamentoDate = new Date(scheduledDate);
    if (agendamentoDate <= new Date()) {
      return reply.status(400).send({
        error: "A data e hora do agendamento deve ser futura",
      });
    }

    // --- CRIAÇÃO DO AGENDAMENTO ---
    console.log("💾 Criando agendamento no banco de dados...");

    const agendamentoData = {
      type: "Entrada", // Agendamentos são sempre entradas
      isVisitor: true,
      isPermissionario: false,
      isScheduled: true, // ← Campo que identifica como agendamento
      scheduledDate: agendamentoDate, // ← Data específica do agendamento
      name: name,
      idNumber: idNumber || "",
      licensePlate: licensePlate || "",
      carModel: carModel || "",
      time: new Date(), // Data de criação do agendamento
      target: target || "",
      contactPerson: contactPerson || "",
      color: color || "",
      phoneNumber: phoneNumber || "",
      imagePath: null, // Agendamentos não têm imagem ainda
    };

    console.log("📊 Dados do agendamento:", agendamentoData);

    const agendamento = await prisma.entry.create({
      data: agendamentoData,
    });

    console.log("✅ Agendamento criado:", {
      id: agendamento.id,
      name: agendamento.name,
      scheduledDate: agendamento.scheduledDate,
    });

    // 📊 PROMETHEUS: Registrar criação de agendamento
    incrementScheduledEntry("created");

    reply.status(201).send({
      message: "Agendamento criado com sucesso",
      agendamento: agendamento,
    });
  } catch (error) {
    console.error("❌ Erro geral no createScheduledEntry:", error);

    if (!reply.sent) {
      reply.status(500).send({
        message: "Erro interno do servidor",
        error: error.message,
      });
    }
  }
};

// No final do arquivo entries-controller.js, certificar que estas funções estão exportadas:

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
