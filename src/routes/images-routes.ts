import type { FastifyInstance } from "fastify";

import * as ImagesController from "../controllers/images-controller.ts";
import * as PessoasNaoAutorizadasController from "../controllers/pessoa-nao-autorizada-controller.ts";
import {
  verifyGuardaRole,
  verifyS2Role,
  verifyToken,
} from "../middleware/auth.js";

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

  // Upload de LOGO do sistema (apenas S2)
  fastify.post(
    "/system-images/upload/logo",
    { preHandler: verifyS2Role },
    ImagesController.uploadLogo
  );

  // Upload de BACKGROUND do sistema (apenas S2)
  fastify.post(
    "/system-images/upload/background",
    { preHandler: verifyS2Role },
    ImagesController.uploadBackground
  );

  // Listar imagens atuais do sistema (autenticado)
  // IMPORTANTE: antes da rota genérica :filename
  fastify.get(
    "/system-images/current",
    { preHandler: verifyToken },
    ImagesController.getCurrentSystemImages
  );

  // Resetar imagem para padrão (apenas S2)
  fastify.delete(
    "/system-images/:type",
    { preHandler: verifyS2Role },
    ImagesController.resetSystemImage
  );

  // Servir imagens do sistema (público para a tela de login)
  fastify.get(
    "/system-images/:filename",
    ImagesController.getSystemImage
  );
}