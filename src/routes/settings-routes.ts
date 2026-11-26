import type { FastifyInstance } from "fastify";

import * as SettingsController from "../controllers/settings-controller.ts";
import { verifyGuardaRole, verifyS2Role } from "../middleware/auth.ts";

export default async function routes(fastify: FastifyInstance) {
  // Destinos - gerenciados pela S2
  fastify.get(
    "/settings/destinations",
    // Leitura liberada para a Guarda: a lista alimenta o formulário de visitante.
    { preHandler: verifyGuardaRole },
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