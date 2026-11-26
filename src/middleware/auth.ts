// Re-exporta os hooks de lib/auth.ts com os nomes usados pelas rotas.
export {
  authenticate as verifyToken,
  requireS2Role as verifyS2Role,
  requireGuardaRole as verifyGuardaRole,
  requireSchedulingRole as verifySchedulingRole,
} from "../lib/auth.js";
