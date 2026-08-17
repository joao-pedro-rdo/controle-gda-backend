import type { FastifyInstance } from "fastify";

import * as SettingsController from "../controllers/settings-controller.ts";
import { verifyS2Role } from "../middleware/auth.js";

export default async function routes(fastify: FastifyInstance) {
  // Cores do sistema - leitura pública (usado na tela de login)
  fastify.get("/settings/colors", SettingsController.getColors);

  // Cores do sistema - gravação apenas S2
  fastify.post(
    "/settings/colors",
    { preHandler: verifyS2Role },
    SettingsController.updateColors
  );

  // Configurações gerais do sistema - apenas S2
  fastify.get(
    "/settings/system",
    { preHandler: verifyS2Role },
    SettingsController.getSystemSettings
  );
  fastify.post(
    "/settings/system",
    { preHandler: verifyS2Role },
    SettingsController.updateSystemSettings
  );
  fastify.post(
    "/settings/system/reset",
    { preHandler: verifyS2Role },
    SettingsController.resetSystemSettings
  );

  // Destinos - apenas S2
  fastify.get(
    "/settings/destinations",
    { preHandler: verifyS2Role },
    SettingsController.getDestinations
  );
  fastify.post(
    "/settings/destinations",
    { preHandler: verifyS2Role },
    SettingsController.addDestination
  );
  fastify.delete(
    "/settings/destinations/:name",
    { preHandler: verifyS2Role },
    SettingsController.deleteDestination
  );
  fastify.post(
    "/settings/destinations/reset",
    { preHandler: verifyS2Role },
    SettingsController.resetDestinations
  );
}