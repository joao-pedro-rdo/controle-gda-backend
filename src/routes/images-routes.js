import * as ImagesController from "../controllers/images-controller.js";
import * as PessoasNaoAutorizadasController from "../controllers/pessoas-nao-autorizadas-controller.js";
import {
  verifyToken,
  verifyS2Role,
  verifyGuardaRole,
} from "../middleware/auth.js";

export default async function routes(fastify) {
  // Rota protegida para servir imagens de visitantes
  fastify.get(
    "/images/visitors/:filename",
    { preHandler: verifyToken },
    ImagesController.getVisitorImage
  );

  // Rota para verificar se imagem existe (sem retornar a imagem)
  fastify.head(
    "/images/visitors/:filename",
    { preHandler: verifyToken },
    ImagesController.checkVisitorImageExists
  );

  // Rota protegida para servir imagens de permissionários
  fastify.get(
    "/images/permissionarios/:filename",
    { preHandler: verifyToken },
    ImagesController.getPermissionarioImage
  );

  // 🔧 IMAGEM DE PESSOA NÃO AUTORIZADA - Guarda + S2 podem ver
  fastify.get(
    "/images/pessoas-nao-autorizadas/:filename",
    { preHandler: verifyGuardaRole }, // 🔧 Guarda pode ver imagens
    PessoasNaoAutorizadasController.getImage
  );
}
