import fastify from "fastify";
import helmet from "@fastify/helmet";
import path from "path";
import { fileURLToPath } from "url";
import fastifyStatic from "@fastify/static";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import fastifyCookie from "@fastify/cookie";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 📊 Importar Prometheus
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

// Rotas
import vehiclesRoute from "./routes/vehicles-routes.js";
import entriesRoute from "./routes/entries-routes.js";
import authRoutes from "./routes/auth-routes.js";
import driversRoutes from "./routes/drivers-routes.js";
// import viaturasRoutes from "./routes/viaturas-routes.js"; Retirado por não ser utilizado
// import missionsRouter from "./routes/mission-routes.js";
import surveillanceRoutes from "./routes/surveillance-routes.js";
import permissionarioRoutes from "./routes/permissionario-routes.js";
import imagesRoutes from "./routes/images-routes.js";
import pessoasNaoAutorizadasRoutes from "./routes/pessoas-nao-autorizadas-routes.js";
import settingsRoutes from "./routes/settings-routes.js";

const app = fastify();

// Registre o plugin de CORS primeiro, antes de outras configurações
app.register(cors, {
  origin: true, // permite todas as origens
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization"],
});

// Adicionar suporte para multipart/form-data (para upload de arquivos)
app.register(multipart, {
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max file size
  },
});

app.register(helmet);

// 📊 PROMETHEUS: Adicionar middleware de métricas
// IMPORTANTE: Adicionar ANTES das rotas para capturar todas as requisições
app.addHook("onRequest", prometheusMiddleware);

// Configuração para servir arquivos estáticos com headers CORS apropriados
// app.register(fastifyStatic, {
//   root: path.join(__dirname, '../uploads'),
//   prefix: '/uploads/',
//   decorateReply: false,
//   setHeaders: (res) => {
//     res.setHeader('Access-Control-Allow-Origin', '*');
//     res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
//   }
// });

// Servir imagens públicas do sistema (logo e background)
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

await app.register(fastifyCookie, {
  secret: process.env.COOKIE_SECRET || "controle-gda-cookie-secret-2025",
  parseOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  },
});

// 📊 PROMETHEUS: Registrar rota /metrics (SEM autenticação!)
app.register(metricsRoutes);

// Registrar rotas da aplicação
app.register(vehiclesRoute);
app.register(entriesRoute);
app.register(authRoutes);
app.register(driversRoutes);
// app.register(viaturasRoutes)
// app.register(missionsRouter);
app.register(surveillanceRoutes);
app.register(permissionarioRoutes);
app.register(imagesRoutes);
app.register(pessoasNaoAutorizadasRoutes);
app.register(settingsRoutes);

const port = 5000;

app.listen({ port: port, host: "0.0.0.0" }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`🚀 Server running on ${address}`);
  console.log(`📊 Prometheus metrics available at ${address}/metrics`);
  console.log(`❤️  Health check available at ${address}/health`);

  // 📊 Iniciar atualização periódica dos Gauges (a cada 1 minuto)
  startMetricsUpdater();
});

/**
 * 🔄 Atualiza Gauges periodicamente
 * 
 * Esta função busca dados do banco e atualiza as métricas tipo Gauge:
 * - Total de veículos
 * - Total de permissionários
 * - Total de pessoas não autorizadas
 * - Total de usuários por role
 */
async function startMetricsUpdater() {
  console.log("🔄 Iniciando atualizador de métricas...");

  // Atualizar imediatamente na inicialização
  await updateGauges();

  // Atualizar a cada 60 segundos
  setInterval(async () => {
    await updateGauges();
  }, 60000);
}

async function updateGauges() {
  try {
    // Contar veículos
    const vehiclesCount = await prisma.vehicles.count();
    updateVehiclesGauge(vehiclesCount);

    // Contar permissionários
    const permissionariosCount = await prisma.permissionario.count();
    updatePermissionariosGauge(permissionariosCount);

    // Contar pessoas não autorizadas
    const unauthorizedCount = await prisma.pessoaNaoAutorizada.count();
    updateUnauthorizedPersonsGauge(unauthorizedCount);

    // Contar usuários por role
    const usersGrouped = await prisma.user.groupBy({
      by: ["role"],
      _count: true,
    });

    usersGrouped.forEach((group) => {
      updateUsersGauge(group.role, group._count);
    });

    // 🆕 Contar pessoas dentro da OM (entradas sem saída)
    // Visitantes dentro
    const visitorsInside = await prisma.entry.count({
      where: {
        type: "Entrada",
        exited: false,
        isVisitor: true,
        isScheduled: false, // Não contar agendamentos
      },
    });
    updatePeopleInsideOM("visitor", visitorsInside);

    // Permissionários dentro
    const permissionariosInside = await prisma.entry.count({
      where: {
        type: "Entrada",
        exited: false,
        isPermissionario: true,
        isScheduled: false,
      },
    });
    updatePeopleInsideOM("permissionario", permissionariosInside);

    // Militares dentro (se existir o campo)
    const militaresInside = await prisma.entry.count({
      where: {
        type: "Entrada",
        exited: false,
        isMilitar: true,
        isScheduled: false,
      },
    }).catch(() => 0); // Se não existir o campo, retornar 0
    updatePeopleInsideOM("militar", militaresInside);

    // Log opcional (comentar em produção)
    // console.log(`📊 [Metrics Updated] Vehicles: ${vehiclesCount}, Permissionários: ${permissionariosCount}, Dentro: V=${visitorsInside} P=${permissionariosInside} M=${militaresInside}`);
  } catch (error) {
    console.error("❌ Erro ao atualizar métricas:", error.message);
  }
}
