import type { FastifyInstance } from "fastify";

import * as VehiclesController from "../controllers/vehicles-controller.ts";
import * as VehiclesCsvController from "../controllers/vehicles-csv-controller.js";
import { verifyS2Role } from "../middleware/auth.js";

export default async function routes(fastify: FastifyInstance) {
  // Consultas públicas (a Guarda também utiliza a busca por placa)
  fastify.get("/vehicles", VehiclesController.listVehicles);
  fastify.get("/vehicles/:id", VehiclesController.getVehicleById);
  fastify.get(
    "/vehiclebyplate/:licensePlate",
    VehiclesController.getVehicleByPlate
  );

  // Escritas restritas ao perfil S2
  fastify.post(
    "/vehicles",
    { preHandler: verifyS2Role },
    VehiclesController.createVehicle
  );
  fastify.patch(
    "/vehicles/:id",
    { preHandler: verifyS2Role },
    VehiclesController.updateVehicle
  );
  fastify.delete(
    "/vehicles/:id",
    { preHandler: verifyS2Role },
    VehiclesController.deleteVehicle
  );

  // Importação CSV - restrita ao perfil S2
  fastify.post(
    "/vehicles/import-csv",
    { preHandler: verifyS2Role },
    VehiclesCsvController.importVehiclesFromCSV
  );
}
