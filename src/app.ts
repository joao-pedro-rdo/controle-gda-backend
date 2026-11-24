import fastify, { type FastifyBaseLogger } from "fastify";
import helmet from "@fastify/helmet";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import fastifyCookie from "@fastify/cookie";

import prometheusMiddleware from "./middleware/prometheus-metrics.ts";
import metricsRoutes from "./routes/metrics-routes.ts";
import {
  updateVehiclesGauge,
  updatePermissionariosGauge,
  updateUnauthorizedPersonsGauge,
  updateUsersGauge,
  updatePeopleInsideOM,
} from "./helpers/prometheus.js";
import { prisma } from "./lib/prisma.js";
import { setupErrorHandler } from "./lib/error-handler.js";
import { parseIpAllowlist, parseTrustProxy } from "./lib/guard-station.js";

import vehiclesRoute from "./routes/vehicles-routes.js";
import entriesRoute from "./routes/entries-routes.js";
import authRoutes from "./routes/auth-routes.js";
import surveillanceRoutes from "./routes/surveillance-routes.ts";
import permissionarioRoutes from "./routes/permissionario-routes.js";
import imagesRoutes from "./routes/images-routes.js";
import pessoasNaoAutorizadasRoutes from "./routes/pessoas-nao-autorizadas-routes.js";
import settingsRoutes from "./routes/settings-routes.js";

export async function buildApp() {
  // Valida GUARDA_TRUSTED_IPS na subida para falhar cedo em caso de erro.
  parseIpAllowlist(process.env.GUARDA_TRUSTED_IPS);

  const app = fastify({
    // Logs em JSON (pino) no stdout do container. LOG_LEVEL=debug mostra
    // também cada requisição e os erros 4xx.
    logger:
      process.env.NODE_ENV === "test"
        ? false
        : { level: process.env.LOG_LEVEL || "info" },
    disableRequestLogging: true,
    // Só usa X-Forwarded-For de proxies confiáveis (ver lib/guard-station.ts).
    trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
  });

  setupErrorHandler(app);

  app.register(cors, {
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });

  //Habilita upload de arquivos com limite de 5MB.
  app.register(multipart, {
    limits: {
      fileSize: 5 * 1024 * 1024,
    },
  });

  app.register(helmet);

  // Metrics must be registered before routes so every request is observed.
  app.addHook("onRequest", prometheusMiddleware);

  app.addHook("onResponse", async (request, reply) => {
    request.log.debug(
      {
        method: request.method,
        url: request.routeOptions?.url ?? request.url,
        statusCode: reply.statusCode,
        ms: Math.round(reply.elapsedTime),
      },
      "request"
    );
  });

  // Configuração do cookie para autenticação
  await app.register(fastifyCookie, {
    secret: process.env.COOKIE_SECRET || "controle-gda-cookie-secret-2025",
    parseOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    },
  });

  //Registro de todas as rotas
  app.register(metricsRoutes);
  app.register(vehiclesRoute);
  app.register(entriesRoute);
  app.register(authRoutes);
  app.register(surveillanceRoutes);
  app.register(permissionarioRoutes);
  app.register(imagesRoutes);
  app.register(pessoasNaoAutorizadasRoutes);
  app.register(settingsRoutes);

  return app;
}

export async function startMetricsUpdater(log: FastifyBaseLogger) {
  await updateGauges(log);
  setInterval(() => void updateGauges(log), 60000);
}

async function updateGauges(log: FastifyBaseLogger) {
  try {
    const vehiclesCount = await prisma.vehicles.count();
    updateVehiclesGauge(vehiclesCount);

    const permissionariosCount = await prisma.permissionario.count();
    updatePermissionariosGauge(permissionariosCount);

    const unauthorizedCount = await prisma.pessoaNaoAutorizada.count();
    updateUnauthorizedPersonsGauge(unauthorizedCount);

    const usersGrouped = await prisma.user.groupBy({
      by: ["role"],
      _count: true,
    });

    usersGrouped.forEach((group) => {
      updateUsersGauge(group.role, group._count);
    });

    const visitorsInside = await prisma.entry.count({
      where: {
        type: "Entrada",
        exited: false,
        isVisitor: true,
        isScheduled: false,
      },
    });
    updatePeopleInsideOM("visitor", visitorsInside);

    const permissionariosInside = await prisma.entry.count({
      where: {
        type: "Entrada",
        exited: false,
        isPermissionario: true,
        isScheduled: false,
      },
    });
    updatePeopleInsideOM("permissionario", permissionariosInside);

    // This field is not present in every deployed Prisma schema yet.
    const militaresInside = await prisma.entry
      .count({
        where: {
          type: "Entrada",
          exited: false,
          isMilitar: true,
          isScheduled: false,
        } as any,
      })
      .catch(() => 0);
    updatePeopleInsideOM("militar", militaresInside);
  } catch (error) {
    log.warn({ err: error }, "Falha ao atualizar métricas de negócio");
  }
}
