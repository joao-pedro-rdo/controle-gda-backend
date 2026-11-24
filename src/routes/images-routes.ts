import type { FastifyInstance } from "fastify";

import * as ImagesController from "../controllers/images-controller.ts";
import * as PessoasNaoAutorizadasController from "../controllers/pessoa-nao-autorizada-controller.ts";
import { verifyGuardaRole, verifyToken } from "../middleware/auth.js";

export default async function routes(fastify: FastifyInstance) {
  // Imagens de visitantes - qualquer perfil autenticado
  fastify.get(
    "/images/visitors/:filename",
    { preHandler: verifyToken },
    ImagesController.getVisitorImage
  );
  fastify.head(
    "/images/visitors/:filename",
    { preHandler: verifyToken },
    ImagesController.checkVisitorImageExists
  );

  // Imagens de permissionários - qualquer perfil autenticado
  fastify.get(
    "/images/permissionarios/:filename",
    { preHandler: verifyToken },
    ImagesController.getPermissionarioImage
  );

  // Imagens de pessoas não autorizadas - Guarda (e perfis superiores)
  fastify.get(
    "/images/pessoas-nao-autorizadas/:filename",
    { preHandler: verifyGuardaRole },
    PessoasNaoAutorizadasController.getImage
  );
}
