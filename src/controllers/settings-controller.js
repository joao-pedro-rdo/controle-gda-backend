import { prisma } from "../helpers/utils.js";

// ==========================================
// 1. CONFIGURAÇÕES GERAIS DO SISTEMA
// ==========================================

/**
 * GET /settings/system
 * Retorna as configurações gerais do sistema (título, logo, background)
 */
export const getSystemSettings = async (req, reply) => {
  try {
    const settings = await prisma.systemSettings.findMany();

    // Converter array de configurações em objeto
    const config = settings.reduce((acc, row) => {
      acc[row.settingKey] = row.settingValue;
      return acc;
    }, {});

    // Valores padrão caso não existam no banco
    reply.status(200).send({
      pageTitle: config.page_title || process.env.DEFAULT_PAGE_TITLE || "Guarda - 6° RCB",
      logo: config.logo_path || process.env.DEFAULT_LOGO_PATH || "/img/logo.png",
      background: config.background_path || process.env.DEFAULT_BACKGROUND_PATH || "/img/background.jpg",
    });
  } catch (error) {
    console.error("❌ Erro ao buscar configurações:", error);
    reply.status(500).send({ 
      error: "Erro ao buscar configurações do sistema",
      message: error.message 
    });
  }
};

/**
 * POST /settings/system
 * Atualiza uma ou mais configurações do sistema
 */
export const updateSystemSettings = async (req, reply) => {
  try {
    const { pageTitle, logo, background } = req.body;

    // Atualizar pageTitle
    if (pageTitle !== undefined) {
      await prisma.systemSettings.upsert({
        where: { settingKey: "page_title" },
        update: { settingValue: pageTitle },
        create: { settingKey: "page_title", settingValue: pageTitle },
      });
    }

    // Atualizar logo
    if (logo !== undefined) {
      await prisma.systemSettings.upsert({
        where: { settingKey: "logo_path" },
        update: { settingValue: logo },
        create: { settingKey: "logo_path", settingValue: logo },
      });
    }

    // Atualizar background
    if (background !== undefined) {
      await prisma.systemSettings.upsert({
        where: { settingKey: "background_path" },
        update: { settingValue: background },
        create: { settingKey: "background_path", settingValue: background },
      });
    }

    reply.status(200).send({
      success: true,
      message: "Configurações atualizadas com sucesso",
    });
  } catch (error) {
    console.error("❌ Erro ao atualizar configurações:", error);
    reply.status(500).send({ 
      error: "Erro ao atualizar configurações do sistema",
      message: error.message 
    });
  }
};

/**
 * POST /settings/system/reset
 * Restaura as configurações padrão do sistema
 */
export const resetSystemSettings = async (req, reply) => {
  try {
    const defaultSettings = [
      { key: "page_title", value: process.env.DEFAULT_PAGE_TITLE || "Guarda - 6° RCB" },
      { key: "logo_path", value: process.env.DEFAULT_LOGO_PATH || "/img/logo.png" },
      { key: "background_path", value: process.env.DEFAULT_BACKGROUND_PATH || "/img/background.jpg" },
    ];

    // Atualizar todas as configurações para valores padrão
    for (const setting of defaultSettings) {
      await prisma.systemSettings.upsert({
        where: { settingKey: setting.key },
        update: { settingValue: setting.value },
        create: { settingKey: setting.key, settingValue: setting.value },
      });
    }

    reply.status(200).send({
      success: true,
      pageTitle: defaultSettings[0].value,
      logo: defaultSettings[1].value,
      background: defaultSettings[2].value,
    });
  } catch (error) {
    console.error("❌ Erro ao resetar configurações:", error);
    reply.status(500).send({ 
      error: "Erro ao resetar configurações do sistema",
      message: error.message 
    });
  }
};

// ==========================================
// 2. GERENCIAMENTO DE DESTINOS
// ==========================================

/**
 * GET /settings/destinations
 * Retorna a lista de destinos/seções disponíveis
 */
export const getDestinations = async (req, reply) => {
  try {
    const destinations = await prisma.destination.findMany({
      orderBy: [
        { displayOrder: "asc" },
        { name: "asc" },
      ],
    });

    reply.status(200).send({
      destinations: destinations.map((d) => d.name),
    });
  } catch (error) {
    console.error("❌ Erro ao buscar destinos:", error);
    reply.status(500).send({ 
      error: "Erro ao buscar destinos",
      message: error.message 
    });
  }
};

/**
 * POST /settings/destinations
 * Adiciona um novo destino
 */
export const addDestination = async (req, reply) => {
  try {
    const { name } = req.body;

    if (!name || !name.trim()) {
      return reply.status(400).send({ 
        error: "Nome do destino é obrigatório" 
      });
    }

    // Criar novo destino
    await prisma.destination.create({
      data: {
        name: name.trim(),
        isDefault: false,
      },
    });

    // Retornar lista atualizada
    const destinations = await prisma.destination.findMany({
      orderBy: [
        { displayOrder: "asc" },
        { name: "asc" },
      ],
    });

    reply.status(201).send({
      success: true,
      destinations: destinations.map((d) => d.name),
    });
  } catch (error) {
    console.error("❌ Erro ao adicionar destino:", error);

    // Verificar se é erro de duplicação
    if (error.code === "P2002") {
      return reply.status(400).send({ 
        error: "Destino já existe" 
      });
    }

    reply.status(500).send({ 
      error: "Erro ao adicionar destino",
      message: error.message 
    });
  }
};

/**
 * DELETE /settings/destinations/:name
 * Remove um destino específico
 */
export const deleteDestination = async (req, reply) => {
  try {
    const { name } = req.params;

    await prisma.destination.delete({
      where: { name: decodeURIComponent(name) },
    });

    // Retornar lista atualizada
    const destinations = await prisma.destination.findMany({
      orderBy: [
        { displayOrder: "asc" },
        { name: "asc" },
      ],
    });

    reply.status(200).send({
      success: true,
      destinations: destinations.map((d) => d.name),
    });
  } catch (error) {
    console.error("❌ Erro ao remover destino:", error);

    if (error.code === "P2025") {
      return reply.status(404).send({ 
        error: "Destino não encontrado" 
      });
    }

    reply.status(500).send({ 
      error: "Erro ao remover destino",
      message: error.message 
    });
  }
};

/**
 * POST /settings/destinations/reset
 * Restaura a lista de destinos padrão
 */
export const resetDestinations = async (req, reply) => {
  try {
    // Remover apenas destinos customizados (não padrão)
    await prisma.destination.deleteMany({
      where: { isDefault: false },
    });

    // Retornar lista atualizada
    const destinations = await prisma.destination.findMany({
      orderBy: [
        { displayOrder: "asc" },
        { name: "asc" },
      ],
    });

    reply.status(200).send({
      success: true,
      destinations: destinations.map((d) => d.name),
    });
  } catch (error) {
    console.error("❌ Erro ao resetar destinos:", error);
    reply.status(500).send({ 
      error: "Erro ao resetar destinos",
      message: error.message 
    });
  }
};
