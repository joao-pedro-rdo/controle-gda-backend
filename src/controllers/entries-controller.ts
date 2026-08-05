import type { FastifyReply, FastifyRequest } from "fastify";
import type { MultipartFile } from "@fastify/multipart";

import {
  confirmScheduledEntryParamsSchema,
  createEntrySchema,
  createExitSchema,
  createScheduledEntrySchema,
  dateRangeQuerySchema,
  entryIdParamsSchema,
  scheduledDateQuerySchema,
  updateEntrySchema,
} from "../schemas/entries-schema.js";
import { entryService, type EntryImageInput } from "../services/entry-service.js";
import { sendSuccess } from "../lib/http.js";
import { parseBody, parseParams, parseQuery } from "../lib/validation.js";

interface MultipartResult {
  form: Record<string, string>;
  image: EntryImageInput | null;
}

async function readMultipartForm(request: FastifyRequest): Promise<MultipartResult> {
  const parts = request.parts();
  const form: Record<string, string> = {};
  let image: EntryImageInput | null = null;

  for await (const part of parts) {
    if (part.type === "file" && part.fieldname === "image") {
      const file = part as MultipartFile;
      const buffer = await file.toBuffer();
      image = { buffer, bytesRead: buffer.length };
    } else if (part.type === "field") {
      form[part.fieldname] = part.value as string;
    }
  }

  return { form, image };
}

export async function index(req: FastifyRequest, reply: FastifyReply) {
  return sendSuccess(reply, await entryService.index());
}

export async function getEntryById(req: FastifyRequest, reply: FastifyReply) {
  const { id } = parseParams(entryIdParamsSchema, req.params);
  return sendSuccess(reply, await entryService.getById(id));
}

export async function getEntriesByDate(
  req: FastifyRequest,
  reply: FastifyReply
) {
  const body = parseBody(dateRangeQuerySchema, req.body);
  return sendSuccess(reply, await entryService.getEntriesByDate(body));
}

export async function createEntry(req: FastifyRequest, reply: FastifyReply) {
  const { form, image } = await readMultipartForm(req);
  const input = parseBody(createEntrySchema, form);
  const entry = await entryService.createEntry(input, {
    role: req.user?.role ?? "",
    image,
  });
  return sendSuccess(
    reply,
    { message: "Entrada registrada com sucesso", entry },
    201
  );
}

export async function createExit(req: FastifyRequest, reply: FastifyReply) {
  const body = parseBody(createExitSchema, req.body);
  const result = await entryService.createExit(body);
  return sendSuccess(
    reply,
    { message: "Saída registrada com sucesso", ...result },
    201
  );
}

export async function updateEntry(req: FastifyRequest, reply: FastifyReply) {
  const body = parseBody(updateEntrySchema, req.body);
  const updated = await entryService.markExited(body.id, body.exited);
  return sendSuccess(reply, updated, 201);
}

export async function getScheduledEntries(
  req: FastifyRequest,
  reply: FastifyReply
) {
  const { date } = parseQuery(scheduledDateQuerySchema, req.query);
  return sendSuccess(
    reply,
    await entryService.getScheduledEntries(date ? new Date(date) : undefined)
  );
}

export async function getScheduledEntriesByDateRange(
  req: FastifyRequest,
  reply: FastifyReply
) {
  const body = parseBody(dateRangeQuerySchema, req.body);
  return sendSuccess(
    reply,
    await entryService.getScheduledEntriesByDateRange(body)
  );
}

export async function createScheduledEntry(
  req: FastifyRequest,
  reply: FastifyReply
) {
  const body = parseBody(createScheduledEntrySchema, req.body);
  const agendamento = await entryService.createScheduledEntry(body);
  return sendSuccess(
    reply,
    { message: "Agendamento criado com sucesso", agendamento },
    201
  );
}

export async function confirmScheduledEntry(
  req: FastifyRequest,
  reply: FastifyReply
) {
  const { id } = parseParams(confirmScheduledEntryParamsSchema, req.params);
  const { image } = await readMultipartForm(req);
  const entry = await entryService.confirmScheduledEntry(id, {
    role: req.user?.role ?? "",
    image,
  });
  return sendSuccess(
    reply,
    { message: "Agendamento confirmado com sucesso", entry },
    200
  );
}
