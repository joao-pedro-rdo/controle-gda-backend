import {
  authenticate,
  requireGuardaRole,
  requireS2Role,
} from "../lib/auth.ts";

// Re-exporta os hooks centralizados mantendo os nomes usados pelas rotas.
export { authenticate as verifyToken };
export { requireS2Role as verifyS2Role };
export { requireGuardaRole as verifyGuardaRole };
