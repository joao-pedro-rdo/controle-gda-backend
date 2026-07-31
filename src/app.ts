import fastify from "fastify";
import helmet from "@fastify/helmet";
import path from "path";
import { fileURLToPath } from "url";
import fastifyStatic from "@fastify/static";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import fastifyCookie from "@fastify/cookie";

import prometheusMiddleware from "./middleware/prometheus-metrics.js";
import metricsRoutes from "./routes/metrics-routes.js";
import {
  updateVehiclesGauge,
  updatePermissionariosGauge,
  updateUnauthorizedPersonsGauge,
  updateUsersGauge,
  updatePeopleInsideOM,
} from "./helpers/prometheus.js";
import { prisma } from "./helpers/utils.js";

import vehiclesRoute from "./routes/vehicles-routes.js";
import entriesRoute from "./routes/entries-routes.js";
import authRoutes from "./routes/auth-routes.js";
import driversRoutes from "./routes/drivers-routes.js";
import surveillanceRoutes from "./routes/surveillance-routes.js";
import permissionarioRoutes from "./routes/permissionario-routes.js";
import imagesRoutes from "./routes/images-routes.js";
import pessoasNaoAutorizadasRoutes from "./routes/pessoas-nao-autorizadas-routes.js";
import settingsRoutes from "./routes/settings-routes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function buildApp() {
  const app = fastify();

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

  //Servir arquivos estaticos
  app.register(fastifyStatic, {
    root: path.join(__dirname, "../public"),
    prefix: "/public/",
    decorateReply: false,
    setHeaders: (res) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      res.setHeader("Cache-Control", "public, max-age=86400");
    },
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
  app.register(driversRoutes);
  app.register(surveillanceRoutes);
  app.register(permissionarioRoutes);
  app.register(imagesRoutes);
  app.register(pessoasNaoAutorizadasRoutes);
  app.register(settingsRoutes);

  return app;
}

export async function startMetricsUpdater() {
  console.log("🔄 Iniciando atualizador de métricas...");

  await updateGauges();

  setInterval(async () => {
    await updateGauges();
  }, 60000);
}

async function updateGauges() {
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
    const message = error instanceof Error ? error.message : String(error);
    console.error("❌ Erro ao atualizar métricas:", message);
  }
}
