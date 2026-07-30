import * as SettingsController from "../controllers/settings-controller.js";
import { verifyToken, verifyS2Role } from "../middleware/auth.js";

export default async function routes(fastify) {
  // ==========================================
  // CORES DO SISTEMA
  // ==========================================

  /**
   * GET /settings/colors
   * Retorna as cores do sistema (público - usado no login)
   */
  fastify.get(
    "/settings/colors",
    SettingsController.getColors
  );

  /**
   * POST /settings/colors
   * Atualiza as cores do sistema
   * Requer: Autenticação + Role S2
   */
  fastify.post(
    "/settings/colors",
    { preHandler: verifyS2Role },
    SettingsController.updateColors
  );

  // ==========================================
  // CONFIGURAÇÕES GERAIS DO SISTEMA
  // ==========================================
  
  /**
   * GET /settings/system
   * Retorna as configurações gerais do sistema
   * Requer: Autenticação + Role S2
   */
  fastify.get(
    "/settings/system",
    { preHandler: verifyS2Role },
    SettingsController.getSystemSettings
  );

  /**
   * POST /settings/system
   * Atualiza configurações do sistema
   * Requer: Autenticação + Role S2
   */
  fastify.post(
    "/settings/system",
    { preHandler: verifyS2Role },
    SettingsController.updateSystemSettings
  );

  /**
   * POST /settings/system/reset
   * Restaura configurações padrão do sistema
   * Requer: Autenticação + Role S2
   */
  fastify.post(
    "/settings/system/reset",
    { preHandler: verifyS2Role },
    SettingsController.resetSystemSettings
  );

  // ==========================================
  // GERENCIAMENTO DE DESTINOS
  // ==========================================

  /**
   * GET /settings/destinations
   * Lista todos os destinos disponíveis
   * Requer: Autenticação + Role S2
   */
  fastify.get(
    "/settings/destinations",
    { preHandler: verifyS2Role },
    SettingsController.getDestinations
  );

  /**
   * POST /settings/destinations
   * Adiciona um novo destino
   * Requer: Autenticação + Role S2
   */
  fastify.post(
    "/settings/destinations",
    { preHandler: verifyS2Role },
    SettingsController.addDestination
  );

  /**
   * DELETE /settings/destinations/:name
   * Remove um destino específico
   * Requer: Autenticação + Role S2
   */
  fastify.delete(
    "/settings/destinations/:name",
    { preHandler: verifyS2Role },
    SettingsController.deleteDestination
  );

  /**
   * POST /settings/destinations/reset
   * Restaura a lista de destinos padrão
   * Requer: Autenticação + Role S2
   */
  fastify.post(
    "/settings/destinations/reset",
    { preHandler: verifyS2Role },
    SettingsController.resetDestinations
  );
}
