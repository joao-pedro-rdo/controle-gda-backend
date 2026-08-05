import type { FastifyReply, FastifyRequest } from "fastify";

import {
  createVehicleSchema,
  updateVehicleSchema,
  vehicleIdParamsSchema,
  vehiclePlateParamsSchema,
} from "../schemas/vehicles-schema.js";
import { vehicleService } from "../services/vehicle-service.js";
import { sendSuccess } from "../lib/http.js";
import { parseBody, parseParams } from "../lib/validation.js";

export async function listVehicles(req: FastifyRequest, reply: FastifyReply) {
  return sendSuccess(reply, await vehicleService.list());
}

export async function getVehicleById(req: FastifyRequest, reply: FastifyReply) {
  const { id } = parseParams(vehicleIdParamsSchema, req.params);
  return sendSuccess(reply, await vehicleService.getById(id));
}

export async function getVehicleByPlate(
  req: FastifyRequest,
  reply: FastifyReply
) {
  const { licensePlate } = parseParams(vehiclePlateParamsSchema, req.params);
  return sendSuccess(reply, await vehicleService.getByPlate(licensePlate));
}

export async function createVehicle(req: FastifyRequest, reply: FastifyReply) {
  const body = parseBody(createVehicleSchema, req.body);
  return sendSuccess(reply, await vehicleService.create(body), 201);
}

export async function updateVehicle(req: FastifyRequest, reply: FastifyReply) {
  const { id } = parseParams(vehicleIdParamsSchema, req.params);
  const body = parseBody(updateVehicleSchema, req.body);
  return sendSuccess(reply, await vehicleService.update(id, body));
}

export async function deleteVehicle(req: FastifyRequest, reply: FastifyReply) {
  const { id } = parseParams(vehicleIdParamsSchema, req.params);
  return sendSuccess(reply, await vehicleService.remove(id));
}
