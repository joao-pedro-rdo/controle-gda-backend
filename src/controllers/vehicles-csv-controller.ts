import path from "path";
import type { FastifyReply, FastifyRequest } from "fastify";

import { badRequest } from "../lib/errors.js";
import { sendSuccess } from "../lib/http.js";
import { importVehiclesCsv } from "../services/vehicle-csv-import-service.js";

export async function importVehiclesFromCSV(req: FastifyRequest, reply: FastifyReply) {
  if (!req.isMultipart()) {
    throw badRequest("A requisição deve ser do tipo multipart/form-data");
  }

  const file = await req.file();
  if (!file) throw badRequest("Nenhum arquivo foi enviado");

  if (path.extname(file.filename).toLowerCase() !== ".csv") {
    throw badRequest("O arquivo deve ser um CSV");
  }

  const buffer = await file.toBuffer();
  if (file.file.truncated) throw badRequest("Arquivo excede o limite de 5MB");

  const results = await importVehiclesCsv(buffer.toString("utf8"));
  return sendSuccess(reply, {
    success: true,
    message: "Importação concluída",
    results,
  });
}
