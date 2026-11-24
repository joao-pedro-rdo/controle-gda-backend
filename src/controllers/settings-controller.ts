import type { FastifyReply, FastifyRequest } from "fastify";

import {
  createDestinationSchema,
  destinationNameParamsSchema,
} from "../schemas/settings-schema.js";
import { settingsService } from "../services/settings-service.js";
import { sendSuccess } from "../lib/http.js";
import { parseBody, parseParams } from "../lib/validation.js";

export async function getDestinations(
  _req: FastifyRequest,
  reply: FastifyReply
) {
  const destinations = await settingsService.listDestinations();
  return sendSuccess(reply, { destinations });
}

export async function addDestination(
  req: FastifyRequest,
  reply: FastifyReply
) {
  const body = parseBody(createDestinationSchema, req.body);
  const destinations = await settingsService.addDestination(body);
  return sendSuccess(reply, { destinations }, 201);
}

export async function deleteDestination(
  req: FastifyRequest,
  reply: FastifyReply
) {
  const params = parseParams(destinationNameParamsSchema, req.params);
  const destinations = await settingsService.deleteDestination(params);
  return sendSuccess(reply, { destinations });
}

export async function resetDestinations(
  _req: FastifyRequest,
  reply: FastifyReply
) {
  const destinations = await settingsService.resetDestinations();
  return sendSuccess(reply, { destinations });
}