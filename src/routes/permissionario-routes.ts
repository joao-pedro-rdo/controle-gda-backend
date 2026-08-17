import type { FastifyInstance } from "fastify";

import * as PermissionarioController from "../controllers/permissionario-controller.ts";
import { verifyToken, verifyS2Role } from "../middleware/auth.js";

export default async function routes(fastify: FastifyInstance) {
  // Consulta básica com autenticação (lista)
  fastify.get(
    "/permissionarios",
    { preHandler: verifyToken },
    PermissionarioController.index
  );

  // Detalhes e escritas restritos ao perfil S2
  fastify.get(
    "/permissionarios/:id",
    { preHandler: verifyS2Role },
    PermissionarioController.getById
  );
  fastify.post(
    "/permissionarios",
    { preHandler: verifyS2Role },
    PermissionarioController.create
  );
  fastify.patch(
    "/permissionarios/:id",
    { preHandler: verifyS2Role },
    PermissionarioController.update
  );
  fastify.delete(
    "/permissionarios/:id",
    { preHandler: verifyS2Role },
    PermissionarioController.remove
  );

  // Rota pública para validação de QR Code (usada pelo frontend)
  fastify.get(
    "/permissionarioByCPF/:cpf",
    PermissionarioController.getByCpf
  );
}
