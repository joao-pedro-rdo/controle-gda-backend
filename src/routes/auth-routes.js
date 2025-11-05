import * as AuthController from "../controllers/auth-controller.js";
import * as UserController from "../controllers/user-controller.js";
import { verifyToken } from "../middleware/auth.js";

export default async function routes(fastify) {
  fastify.get("/users", UserController.index);
  fastify.post("/signup", AuthController.signup);
  fastify.post("/login", AuthController.login);
  fastify.post("/logout", AuthController.logout);
  fastify.patch("/updateUser/:id", AuthController.updateUser);
  fastify.patch("/updPass/:id", AuthController.updPass);
  fastify.delete("/deleteUser/:id", AuthController.deleteUser);

  // 🔒 NOVA ROTA: Verificar autenticação via cookie
  fastify.get(
    "/auth/check",
    { preHandler: verifyToken },
    AuthController.checkAuth
  );
}
