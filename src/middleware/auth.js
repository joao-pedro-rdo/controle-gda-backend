import {
  authenticate,
  extractAccessToken,
  findAuthUser,
  requireGuardaRole,
  requireS2Role,
  verifyAccessToken,
} from "../lib/auth.ts";
import { unauthorized } from "../lib/errors.ts";

// Re-exporta os hooks centralizados mantendo os nomes usados pelas rotas.
export { authenticate as verifyToken };
export { requireS2Role as verifyS2Role };
export { requireGuardaRole as verifyGuardaRole };

export const validateRequest = async (req, res) => {
  try {
    const token = extractAccessToken(req);
    if (!token) throw unauthorized("Token de acesso não fornecido");

    req.user = await findAuthUser(verifyAccessToken(token).id);
  } catch (error) {
    return res.status(401).send({ error: "Não autorizado" });
  }
};

export const verifyGuardaRoleController = async (request, reply) => {
  const allowedRoles = ["GUARDA", "S2", "SFPC"];

  if (!request.user) {
    throw unauthorized("Usuário não autenticado");
  }

  if (!allowedRoles.includes(request.user.role)) {
    throw unauthorized(
      `Role '${request.user.role}' não tem permissão para registrar entradas`
    );
  }
};
