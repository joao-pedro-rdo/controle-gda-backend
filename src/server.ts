import { buildApp, startMetricsUpdater } from "./app.js";

const port = Number(process.env.PORT || 5000);
const host = process.env.HOST || "0.0.0.0";

const app = await buildApp();

try {
  // O Fastify já registra "Server listening at ..." com o logger.
  await app.listen({ port, host });
  await startMetricsUpdater(app.log);
} catch (error) {
  app.log.fatal({ err: error }, "Falha ao iniciar o servidor");
  process.exit(1);
}
