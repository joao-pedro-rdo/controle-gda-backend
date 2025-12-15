import * as ImagesController from "../controllers/images-controller.js";
import * as PessoasNaoAutorizadasController from "../controllers/pessoas-nao-autorizadas-controller.js";
import {
  verifyToken,
  verifyS2Role,
  verifyGuardaRole,
} from "../middleware/auth.js";

export default async function routes(fastify) {
  console.log("🔧 Registrando rotas de imagens do sistema...");
  
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

  // ========== ROTAS DE IMAGENS DO SISTEMA (Logo e Background) ==========
  
  // POST - Upload de LOGO (apenas S2)
  fastify.post(
    "/system-images/upload/logo",
    { preHandler: verifyS2Role },
    ImagesController.uploadLogo
  );

  // POST - Upload de BACKGROUND (apenas S2)
  fastify.post(
    "/system-images/upload/background",
    { preHandler: verifyS2Role },
    ImagesController.uploadBackground
  );

  // GET - Listar imagens atuais do sistema (autenticado)
  fastify.get(
    "/system-images/current",
    { preHandler: verifyToken },
    ImagesController.getCurrentSystemImages
  );

  // DELETE - Resetar imagem para padrão (apenas S2)
  fastify.delete(
    "/system-images/:type",
    { preHandler: verifyS2Role },
    ImagesController.resetSystemImage
  );

  // GET - Servir imagens do sistema (público para permitir acesso na tela de login)
  fastify.get(
    "/system-images/:filename",
    ImagesController.getSystemImage
  );

  console.log("✅ Rotas de imagens do sistema registradas:");
  console.log("   POST /system-images/upload/logo");
  console.log("   POST /system-images/upload/background");
  console.log("   GET /system-images/current");
  console.log("   DELETE /system-images/:type");
  console.log("   GET /system-images/:filename");
}
