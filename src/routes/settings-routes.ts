import type { FastifyInstance } from "fastify";

import * as SettingsController from "../controllers/settings-controller.ts";
import { verifyS2Role } from "../middleware/auth.ts";

export default async function routes(fastify: FastifyInstance) {
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