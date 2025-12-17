import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Seed para inicializar as configurações do sistema
 * Popula as tabelas: system_settings e destinations
 */
async function seedSettings() {
  console.log("🌱 Iniciando seed das configurações do sistema...");

  try {
    // ==========================================
    // 1. CONFIGURAÇÕES GERAIS DO SISTEMA
    // ==========================================

    console.log("📝 Inserindo configurações padrão do sistema...");

    const systemSettings = [
      { settingKey: "page_title", settingValue: "Guarda - 6° RCB" },
      { settingKey: "logo_path", settingValue: "/img/logo.png" },
      { settingKey: "background_path", settingValue: "/img/background.jpg" },
    ];

    for (const setting of systemSettings) {
      await prisma.systemSettings.upsert({
        where: { settingKey: setting.settingKey },
        update: { settingValue: setting.settingValue },
        create: setting,
      });
      console.log(`   ✅ ${setting.settingKey}: ${setting.settingValue}`);
    }

    // ==========================================
    // 2. DESTINOS PADRÃO
    // ==========================================

    console.log("\n📍 Inserindo destinos padrão...");

    const destinations = [
      { name: "RP", displayOrder: 1, isDefault: true },
      { name: "SFPC", displayOrder: 2, isDefault: true },
      { name: "Cmt", displayOrder: 3, isDefault: true },
      { name: "SCmt", displayOrder: 4, isDefault: true },
      { name: "Estande", displayOrder: 5, isDefault: true },
      { name: "Adj Cmdo", displayOrder: 6, isDefault: true },
      { name: "SecInfor", displayOrder: 7, isDefault: true },
      { name: "SecJur", displayOrder: 8, isDefault: true },
      { name: "S1", displayOrder: 9, isDefault: true },
      { name: "S2", displayOrder: 10, isDefault: true },
      { name: "S3", displayOrder: 11, isDefault: true },
      { name: "S4", displayOrder: 12, isDefault: true },
      { name: "Pelotões", displayOrder: 13, isDefault: true },
      { name: "SubCias", displayOrder: 14, isDefault: true },
      { name: "Outros", displayOrder: 15, isDefault: true },
    ];

    for (const destination of destinations) {
      await prisma.destination.upsert({
        where: { name: destination.name },
        update: {
          displayOrder: destination.displayOrder,
          isDefault: destination.isDefault,
        },
        create: destination,
      });
      console.log(`   ✅ ${destination.name}`);
    }

    console.log("\n✨ Seed das configurações concluído com sucesso!");
    console.log(`   📊 ${systemSettings.length} configurações do sistema`);
    console.log(`   📍 ${destinations.length} destinos padrão`);

  } catch (error) {
    console.error("❌ Erro ao executar seed das configurações:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Executar seed
seedSettings()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
