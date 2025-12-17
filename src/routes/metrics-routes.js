/**
 * 📊 ROTA /metrics - Endpoint do Prometheus
 * 
 * Esta rota expõe as métricas no formato Prometheus.
 * 
 * IMPORTANTE:
 * - Esta rota é PÚBLICA (sem autenticação)
 * - O Prometheus fará scraping desta rota periodicamente
 * - Retorna texto em formato específico do Prometheus
 */

import { register } from '../helpers/prometheus.js';

export default async function metricsRoutes(fastify) {
  /**
   * GET /metrics
   * 
   * Retorna todas as métricas coletadas no formato Prometheus
   * 
   * Exemplo de resposta:
   * # HELP entries_total Total de entradas registradas
   * # TYPE entries_total counter
   * entries_total{type="visitor",status="success",scheduled="false"} 125
   * entries_total{type="permissionario",status="success",scheduled="false"} 340
   */
  fastify.get('/metrics', async (request, reply) => {
    try {
      // Definir content-type específico do Prometheus
      reply.type('text/plain; version=0.0.4; charset=utf-8');
      
      // Retornar todas as métricas em formato Prometheus
      return await register.metrics();
    } catch (error) {
      console.error('❌ Erro ao gerar métricas:', error);
      reply.status(500).send('Erro ao gerar métricas');
    }
  });

  /**
   * GET /health
   * 
   * Endpoint de healthcheck (útil para Kubernetes/Docker)
   */
  fastify.get('/health', async (request, reply) => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  });

  console.log('✅ Rota /metrics registrada (Prometheus)');
  console.log('✅ Rota /health registrada (Healthcheck)');
}
