// Arquivo: back/src/routes/pessoa-nao-autorizada-routes.js
import * as PessoasNaoAutorizadasController from "../controllers/pessoas-nao-autorizadas-controller.js";
import {
  verifyToken,
  verifyS2Role,
  verifyGuardaRole,
} from "../middleware/auth.js";

export default async function routes(fastify) {
  // 🔧 ROTAS DE CONSULTA - Guarda + S2 podem acessar

  // Listar todas as pessoas não autorizadas
  fastify.get(
    "/pessoas-nao-autorizadas",
    { preHandler: verifyGuardaRole }, // 🔧 Guarda pode ver a lista
    PessoasNaoAutorizadasController.index
  );

  // Buscar pessoa não autorizada por ID
  fastify.get(
    "/pessoas-nao-autorizadas/:id",
    { preHandler: verifyGuardaRole }, // 🔧 Guarda pode ver detalhes
    PessoasNaoAutorizadasController.getById
  );

  // 🔒 ROTAS DE MODIFICAÇÃO - Apenas S2 pode acessar

  // Criar nova pessoa não autorizada
  fastify.post(
    "/pessoas-nao-autorizadas",
    { preHandler: verifyS2Role }, // 🔒 Apenas S2
    PessoasNaoAutorizadasController.create
  );

  // Atualizar pessoa não autorizada
  fastify.patch(
    "/pessoas-nao-autorizadas/:id",
    { preHandler: verifyS2Role }, // 🔒 Apenas S2
    PessoasNaoAutorizadasController.update
  );

  // Remover pessoa não autorizada
  fastify.delete(
    "/pessoas-nao-autorizadas/:id",
    { preHandler: verifyS2Role }, // 🔒 Apenas S2
    PessoasNaoAutorizadasController.remove
  );
}
