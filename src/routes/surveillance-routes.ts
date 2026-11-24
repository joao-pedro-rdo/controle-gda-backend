import https from "https";
import axios from "axios";
import type { FastifyInstance } from "fastify";

import { AppError } from "../lib/errors.js";
import { verifyGuardaRole } from "../middleware/auth.ts";

const DEFAULT_TIMEOUT_MS = 5000;

export interface SurveillanceConfig {
  url: string;
  camera: string;
  username?: string;
  password?: string;
  timeoutMs: number;
  insecureTls: boolean;
}

export function readSurveillanceConfig(env = process.env): SurveillanceConfig | null {
  if (!env.SURVEILLANCE_API_URL || !env.SURVEILLANCE_API_CAMERA) return null;
  const timeout = Number(env.SURVEILLANCE_TIMEOUT_MS);
  return {
    url: env.SURVEILLANCE_API_URL.replace(/\/+$/, ""),
    camera: env.SURVEILLANCE_API_CAMERA,
    username: env.SURVEILLANCE_API_USERNAME,
    password: env.SURVEILLANCE_API_PASSWORD,
    timeoutMs: Number.isFinite(timeout) && timeout > 0 ? timeout : DEFAULT_TIMEOUT_MS,
    // Câmeras da intranet costumam usar certificado autoassinado.
    insecureTls: env.SURVEILLANCE_TLS_INSECURE !== "false",
  };
}

// Foto mais recente da câmera da recepção, usada no cadastro de visitante.
export default async function surveillanceRoutes(app: FastifyInstance) {
  app.get(
    "/surveillance/latest-photo",
    { preHandler: verifyGuardaRole },
    async (request) => {
      const config = readSurveillanceConfig();
      if (!config) {
        throw new AppError(503, "SURVEILLANCE_NOT_CONFIGURED", "Câmera de vigilância não configurada");
      }

      try {
        const response = await axios.get<ArrayBuffer>(`${config.url}/${config.camera}/latest.jpg`, {
          auth: config.username ? { username: config.username, password: config.password ?? "" } : undefined,
          httpsAgent: new https.Agent({ rejectUnauthorized: !config.insecureTls }),
          responseType: "arraybuffer",
          timeout: config.timeoutMs,
        });
        const image = Buffer.from(response.data);
        return { imageBase64: `data:image/jpeg;base64,${image.toString("base64")}` };
      } catch (error) {
        request.log.warn({ err: error }, "Falha ao buscar foto da câmera");
        const timedOut =
          axios.isAxiosError(error) && ["ECONNABORTED", "ETIMEDOUT"].includes(error.code ?? "");
        throw new AppError(
          timedOut ? 504 : 502,
          "SURVEILLANCE_UNAVAILABLE",
          timedOut
            ? "A câmera não respondeu a tempo"
            : "Não foi possível obter a imagem do sistema de vigilância"
        );
      }
    }
  );
}
