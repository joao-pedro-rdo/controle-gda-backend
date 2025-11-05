import * as PermissionarioController from "../controllers/permissionario-controller.js";
import { verifyToken } from "../middleware/auth.js";

export default async function routes(fastify) {
  // Middleware para verificar se o usuário é S2
  const verifyS2Role = async (request, reply) => {
    try {
      await verifyToken(request, reply);

      if (request.user && request.user.role !== "S2") {
        return reply.status(403).send({
          error:
            "Acesso não autorizado. Apenas usuários com perfil S2 podem acessar esse recurso.",
        });
      }
    } catch (error) {
      return reply.status(401).send({ error: "Não autorizado" });
    }
  };

  // Rotas que precisam de auth S2
  fastify.get(
    "/permissionarios",
    { preHandler: verifyToken },
    PermissionarioController.index
  );
  fastify.get(
    "/permissionarios/:id",
    { preHandler: verifyS2Role },
    PermissionarioController.getPermissionarioById
  );
  fastify.post(
    "/permissionarios",
    { preHandler: verifyS2Role },
    PermissionarioController.createPermissionario
  );
  fastify.patch(
    "/permissionarios/:id",
    { preHandler: verifyS2Role },
    PermissionarioController.updatePermissionario
  );
  fastify.delete(
    "/permissionarios/:id",
    { preHandler: verifyS2Role },
    PermissionarioController.deletePermissionario
  );

  // Rota pública para validação de QR Code (usada pelo frontend)
  fastify.get(
    "/permissionarioByCPF/:cpf",
    PermissionarioController.getPermissionarioByCPF
  );
}
