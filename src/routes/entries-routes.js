import * as EntriesController from "../controllers/entries-controller.js";
import {
  verifyToken,
  verifyGuardaRole,
  verifyS2Role,
} from "../middleware/auth.js";

export default async function routes(fastify) {
  // IMPORTANTE: Rotas mais específicas devem vir ANTES das genéricas

  // 🆕 NOVA ROTA PARA AGENDAMENTOS
  fastify.post(
    "/entries/schedule",
    { preHandler: verifyS2Role },
    EntriesController.createScheduledEntry
  );

  fastify.get(
    "/entries/scheduled",
    { preHandler: verifyGuardaRole },
    EntriesController.getScheduledEntries
  );

  fastify.post(
    "/entries/scheduled/byDate",
    EntriesController.getScheduledEntriesByDateRange
  );

  fastify.patch(
    "/entries/scheduled/:id/confirm",
    { preHandler: verifyGuardaRole },
    EntriesController.confirmScheduledEntry
  );

  // Rotas que precisam de autenticação básica
  fastify.get("/entries", { preHandler: verifyToken }, EntriesController.index);
  fastify.get(
    "/entries/:id",
    { preHandler: verifyToken },
    EntriesController.getEntryById
  );
  fastify.post(
    "/entries",
    { preHandler: verifyToken },
    EntriesController.createEntry
  );
  fastify.post(
    "/entries/byDate",
    { preHandler: verifyToken },
    EntriesController.getEntriesByDate
  );
  fastify.patch(
    "/entries",
    { preHandler: verifyGuardaRole },
    EntriesController.updateEntry
  );

  // 🆕 ROTA ESPECÍFICA PARA SAÍDAS
  fastify.post(
    "/exits",
    { preHandler: verifyGuardaRole },
    EntriesController.createExit
  );

  // 🔧 ROTAS DE MIGRAÇÃO DE IMAGENS
  fastify.post(
    "/migrate-permissionario-images",
    { preHandler: verifyS2Role },
    EntriesController.migratePermissionarioImages
  );

  fastify.post(
    "/migrate-permissionario-image/:id",
    { preHandler: verifyS2Role },
    EntriesController.migratePermissionarioImageById
  );
}
