import type { FastifyInstance } from "fastify";

import { register } from "../helpers/prometheus.js";
import { prisma } from "../lib/prisma.js";

const DB_CHECK_TIMEOUT_MS = 2000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout após ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

export default async function metricsRoutes(fastify: FastifyInstance) {
  // Prometheus (público, consumido pelo scraper).
  fastify.get("/metrics", async (request, reply) => {
    reply.type(register.contentType);
    return register.metrics();
  });

  // Healthcheck do container: só fica "ok" se o banco responder.
  fastify.get("/health", async (request, reply) => {
    let database: "ok" | "unavailable" = "ok";
    try {
      await withTimeout(prisma.$queryRaw`SELECT 1`, DB_CHECK_TIMEOUT_MS);
    } catch (error) {
      database = "unavailable";
      request.log.warn({ err: error }, "Healthcheck: banco indisponível");
    }

    reply.status(database === "ok" ? 200 : 503);
    return {
      status: database === "ok" ? "ok" : "degraded",
      database,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  });
}
