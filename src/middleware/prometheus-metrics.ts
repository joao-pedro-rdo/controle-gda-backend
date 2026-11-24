import type { FastifyReply, FastifyRequest } from "fastify";

import { httpRequestDuration, httpRequestsTotal } from "../helpers/prometheus.js";

// Hook onRequest: mede latência e status de toda requisição. Registrado em
// app.ts antes das rotas.
export default async function prometheusMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const start = process.hrtime.bigint();

  reply.raw.on("finish", () => {
    try {
      const duration = Number(process.hrtime.bigint() - start) / 1e9;
      const labels = {
        method: request.method,
        path: normalizePath(request.routeOptions?.url || request.url),
        status: String(reply.statusCode),
      };
      httpRequestsTotal.inc(labels);
      httpRequestDuration.observe(labels, duration);
    } catch (error) {
      request.log.warn({ err: error }, "Falha ao registrar métricas HTTP");
    }
  });
}

// Agrupa caminhos com parâmetros (/vehicles/123 -> /vehicles/:id) quando a
// rota não foi encontrada e não há `routeOptions.url` para usar.
export function normalizePath(path: string): string {
  const patterns: [RegExp, string][] = [
    [/\/\d+$/, "/:id"],
    [/\/\d+\//, "/:id/"],
    [/\/vehiclebyplate\/[A-Z0-9-]+/i, "/vehiclebyplate/:licensePlate"],
    [/\/permissionarioByCPF\/\d{11}/, "/permissionarioByCPF/:cpf"],
    [
      /\/(visitors|permissionarios|pessoas-nao-autorizadas)\/[^/]+\.(jpg|jpeg|png|gif|webp)(\.encrypted)?$/i,
      "/$1/:filename",
    ],
  ];
  let normalized = path.split("?")[0];
  for (const [regex, replacement] of patterns) {
    normalized = normalized.replace(regex, replacement);
  }
  return normalized;
}
