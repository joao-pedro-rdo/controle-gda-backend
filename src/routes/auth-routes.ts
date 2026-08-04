import type { FastifyInstance } from "fastify";

import * as AuthController from "../controllers/auth-controller.ts";
import { verifyS2Role, verifyToken } from "../middleware/auth.js";

export default async function routes(fastify: FastifyInstance) {
  fastify.get("/users", { preHandler: verifyS2Role }, AuthController.listUsers);
  fastify.post("/signup", { preHandler: verifyS2Role }, AuthController.signup);
  fastify.post("/login", AuthController.login);
  fastify.post("/logout", AuthController.logout);
  fastify.patch(
    "/updateUser/:id",
    { preHandler: verifyS2Role },
    AuthController.updateUser
  );
  fastify.patch("/updPass/:id", { preHandler: verifyToken }, AuthController.updPass);
  fastify.delete(
    "/deleteUser/:id",
    { preHandler: verifyS2Role },
    AuthController.deleteUser
  );

  // 🔒 NOVA ROTA: Verificar autenticação via cookie
  fastify.get(
    "/auth/check",
    { preHandler: verifyToken },
    AuthController.checkAuth
  );
}
