import type { FastifyInstance } from "fastify";

import * as EntriesController from "../controllers/entries-controller.ts";
import * as MigrationController from "../controllers/entries-migration-controller.js";
import {
  verifyToken,
  verifyGuardaRole,
  verifyS2Role,
} from "../middleware/auth.js";

export default async function routes(fastify: FastifyInstance) {
  // IMPORTANTE: Rotas mais específicas devem vir ANTES das genéricas.

  // Agendamentos
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

  // Entradas
  fastify.get(
    "/entries",
    { preHandler: verifyToken },
    EntriesController.index
  );
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

  // Saídas
  fastify.post(
    "/exits",
    { preHandler: verifyGuardaRole },
    EntriesController.createExit
  );

  // Rotas de migração de imagens (mantidas no controller legado)
  fastify.post(
    "/migrate-permissionario-images",
    { preHandler: verifyS2Role },
    MigrationController.migratePermissionarioImages
  );
  fastify.post(
    "/migrate-permissionario-image/:id",
    { preHandler: verifyS2Role },
    MigrationController.migratePermissionarioImageById
  );
}
