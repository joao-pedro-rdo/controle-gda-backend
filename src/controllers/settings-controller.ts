import type { FastifyReply, FastifyRequest } from "fastify";

import {
  createDestinationSchema,
  destinationNameParamsSchema,
  updateColorsSchema,
  updateSystemSettingsSchema,
} from "../schemas/settings-schema.js";
import { settingsService } from "../services/settings-service.js";
import { sendSuccess } from "../lib/http.js";
import { parseBody, parseParams } from "../lib/validation.js";

export async function getColors(_req: FastifyRequest, reply: FastifyReply) {
  return sendSuccess(reply, await settingsService.getColors());
}

export async function updateColors(req: FastifyRequest, reply: FastifyReply) {
  const body = parseBody(updateColorsSchema, req.body);
  return sendSuccess(reply, await settingsService.updateColors(body));
}

export async function getSystemSettings(
  _req: FastifyRequest,
  reply: FastifyReply
) {
  return sendSuccess(reply, await settingsService.getSystemSettings());
}

export async function updateSystemSettings(
  req: FastifyRequest,
  reply: FastifyReply
) {
  const body = parseBody(updateSystemSettingsSchema, req.body);
  return sendSuccess(reply, await settingsService.updateSystemSettings(body));
}

export async function resetSystemSettings(
  _req: FastifyRequest,
  reply: FastifyReply
) {
  return sendSuccess(reply, await settingsService.resetSystemSettings());
}

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