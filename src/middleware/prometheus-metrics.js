/**
 * 🔍 MIDDLEWARE DE MÉTRICAS PROMETHEUS
 * 
 * Este middleware é executado em TODAS as requisições HTTP.
 * Coleta automaticamente:
 * - Latência de cada endpoint
 * - Status HTTP das respostas
 * - Contagem de requisições
 * - Método HTTP usado
 */

import { httpRequestsTotal, httpRequestDuration } from '../helpers/prometheus.js';

/**
 * Middleware do Fastify para coletar métricas HTTP
 * 
 * COMO FUNCIONA:
 * 1. Antes da requisição: Inicia o cronômetro
 * 2. Após a resposta: Calcula a duração e registra as métricas
 * 
 * @param {FastifyRequest} request
 * @param {FastifyReply} reply
 */
export default async function prometheusMiddleware(request, reply) {
  // ⏱️ Iniciar cronômetro para medir latência
  const startTime = process.hrtime();

  // 🎯 Hook executado APÓS a resposta ser enviada
  reply.raw.on('finish', () => {
    try {
      // Calcular duração em segundos
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const duration = seconds + nanoseconds / 1e9;

      // Normalizar o path (remover IDs específicos para agrupar métricas)
      const path = normalizePath(request.routeOptions?.url || request.url);

      const labels = {
        method: request.method,
        path: path,
        status: reply.statusCode.toString(),
      };

      // 📊 Registrar métricas
      httpRequestsTotal.inc(labels);
      httpRequestDuration.observe(labels, duration);

      // 🐛 Log opcional para debug (comentar em produção)
      // console.log(`📊 [Metrics] ${request.method} ${path} ${reply.statusCode} - ${duration.toFixed(3)}s`);
    } catch (error) {
      // Não quebrar a aplicação se houver erro nas métricas
      console.error('❌ Erro ao registrar métricas:', error.message);
    }
  });
}

/**
 * Normaliza paths para agrupar métricas
 * 
 * Exemplos:
 * /vehicles/123 → /vehicles/:id
 * /entries/456 → /entries/:id
 * /images/visitors/abc.jpg → /images/visitors/:filename
 * 
 * @param {string} path
 * @returns {string} Path normalizado
 */
function normalizePath(path) {
  // Lista de patterns para normalização
  const patterns = [
    // IDs numéricos
    { regex: /\/\d+$/, replacement: '/:id' },
    { regex: /\/\d+\//, replacement: '/:id/' },
    
    // Placas de veículos (ABC1234 ou ABC-1234)
    { regex: /\/vehiclebyplate\/[A-Z0-9-]+/i, replacement: '/vehiclebyplate/:licensePlate' },
    
    // CPF (11 dígitos)
    { regex: /\/permissionarioByCPF\/\d{11}/, replacement: '/permissionarioByCPF/:cpf' },
    
    // Nomes de arquivos de imagem
    { regex: /\/(visitors|permissionarios|pessoas-nao-autorizadas|system-images)\/[^/]+\.(jpg|jpeg|png|gif)$/i, 
      replacement: '/$1/:filename' },
  ];

  let normalizedPath = path;

  // Aplicar cada pattern
  for (const pattern of patterns) {
    normalizedPath = normalizedPath.replace(pattern.regex, pattern.replacement);
  }

  // Remover query strings
  normalizedPath = normalizedPath.split('?')[0];

  return normalizedPath;
}
