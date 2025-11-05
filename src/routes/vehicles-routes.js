import * as VehiclesController from "../controllers/vehicles-controller.js";
import * as VehiclesCsvController from "../controllers/vehicles-csv-controller.js";
import { verifyS2Role } from "../middleware/auth.js";
import { verifyToken } from "../helpers/utils.js";

export default async function routes(fastify) {
  // Rotas existentes
  fastify.get("/vehicles", VehiclesController.index);
  fastify.get("/vehicles/:id", VehiclesController.getVehicleById);
  fastify.get(
    "/vehiclebyplate/:licensePlate",
    VehiclesController.getVehicleByLicensePlate
  );
  fastify.post("/vehicles", VehiclesController.createVehicle);
  fastify.delete("/vehicles/:id", VehiclesController.deleteVehicle);
  fastify.patch("/vehicles/:id", VehiclesController.updateVehicle);

  // Nova rota para importação de CSV - restrita a usuários com perfil S2
  fastify.post("/vehicles/import-csv", {
    onRequest: (request, reply, done) => {
      // Log para debug
      console.log("Headers:", request.headers);
      done();
    },
    // TODO: retirei a verificação de token para testes, mas deve ser reativada
    //preHandler: verifyS2Role, // Middleware para verificar se o usuário é S2
    handler: VehiclesCsvController.importVehiclesFromCSV
  });
}
