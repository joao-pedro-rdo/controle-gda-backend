import type { FastifyInstance } from "fastify";

import * as PessoasNaoAutorizadasController from "../controllers/pessoa-nao-autorizada-controller.ts";
import { verifyGuardaRole, verifyS2Role } from "../middleware/auth.js";

export default async function routes(fastify: FastifyInstance) {
  // Consultas - Guarda + S2 podem acessar
  fastify.get(
    "/pessoas-nao-autorizadas",
    { preHandler: verifyGuardaRole },
    PessoasNaoAutorizadasController.index
  );
  fastify.get(
    "/pessoas-nao-autorizadas/:id",
    { preHandler: verifyGuardaRole },
    PessoasNaoAutorizadasController.getById
  );

  // Modificações - Apenas S2
  fastify.post(
    "/pessoas-nao-autorizadas",
    { preHandler: verifyS2Role },
    PessoasNaoAutorizadasController.create
  );
  fastify.patch(
    "/pessoas-nao-autorizadas/:id",
    { preHandler: verifyS2Role },
    PessoasNaoAutorizadasController.update
  );
  fastify.delete(
    "/pessoas-nao-autorizadas/:id",
    { preHandler: verifyS2Role },
    PessoasNaoAutorizadasController.remove
  );
}