import { buildApp, startMetricsUpdater } from "./app.js";

const port = Number(process.env.PORT || 5000);
const host = process.env.HOST || "0.0.0.0";

const app = await buildApp();

try {
  const address = await app.listen({ port, host });
  console.log(`🚀 Server running on ${address}`);
  console.log(`📊 Prometheus metrics available at ${address}/metrics`);
  console.log(`❤️  Health check available at ${address}/health`);

  await startMetricsUpdater();
} catch (error) {
  console.error(error);
  process.exit(1);
}
