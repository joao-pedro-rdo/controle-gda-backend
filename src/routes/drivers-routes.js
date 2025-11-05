import * as DriversController from "../controllers/driver-controller.js";

export default async function routes(fastify) {
  fastify.get("/driver", DriversController.index);
  fastify.get("/driver/:id", DriversController.getDriverById);
  fastify.post("/driver", DriversController.createDriver);
  fastify.delete("/driver/:id", DriversController.deleteDriver);
  fastify.patch("/driver/:id", DriversController.updateDriver);
}
