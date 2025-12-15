import fastify from "fastify";
import helmet from "@fastify/helmet";
import path from "path";
import { fileURLToPath } from "url";
import fastifyStatic from "@fastify/static";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart"; // Adicionar esta linha
import fastifyCookie from "@fastify/cookie";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

const port = 5000;

app.listen({ port: port, host: "0.0.0.0" }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`🚀 Server running on ${address}`);
});
