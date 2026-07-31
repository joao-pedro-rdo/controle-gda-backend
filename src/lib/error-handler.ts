import type {
  FastifyError,
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from "fastify";
import { ZodError } from "zod";

import { AppError, fromZodError, type ErrorDetails } from "./errors.js";

function getPrismaErrorCode(error: unknown): string | null {
  if (typeof error === "object" && error !== null) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string" && /^P\d{4}$/.test(code)) return code;
  }
  return null;
}

function isZodError(error: unknown): error is ZodError {
  return (
    error instanceof ZodError ||
    (typeof error === "object" &&
      error !== null &&
      (error as { name?: unknown }).name === "ZodError" &&
      Array.isArray((error as ZodError).issues))
  );
}

function getValidationDetails(error: {
  validation?: Array<{
    instancePath?: string;
    message?: string;
    params?: { missingProperty?: string };
  }>;
}): ErrorDetails | undefined {
  if (!Array.isArray(error.validation)) return undefined;

  return error.validation.map((item) => {
    const field =
      (item.instancePath ?? "").slice(1).replace(/\//g, ".") ||
      item.params?.missingProperty ||
      "unknown";
    return { field, message: item.message ?? "Valor inválido" };
  });
}

export function setupErrorHandler(app: FastifyInstance): void {
  app.setNotFoundHandler(
    (request: FastifyRequest, reply: FastifyReply) => {
      reply.status(404).send({
        statusCode: 404,
        code: "NOT_FOUND",
        error: "Rota não encontrada",
        message: `Rota ${request.method} ${request.url} não encontrada`,
      });
    }
  );

  app.setErrorHandler(
    (
      error: FastifyError,
      request: FastifyRequest,
      reply: FastifyReply
    ) => {
      request.log.error({ err: error }, "Request failed");

      const isProduction = process.env.NODE_ENV === "production";

      let statusCode = 500;
      let code = "INTERNAL_ERROR";
      let message = "Erro interno do servidor";
      let details: ErrorDetails | undefined;

      if (error instanceof AppError) {
        statusCode = error.statusCode;
        code = error.code;
        details = error.details;
        message =
          isProduction && !error.expose
            ? "Erro interno do servidor"
            : error.message;
      } else if (isZodError(error)) {
        const converted = fromZodError(error);
        statusCode = converted.statusCode;
        code = converted.code;
        message = converted.message;
        details = converted.details;
      } else if (error.validation) {
        statusCode = 400;
        code = "VALIDATION_ERROR";
        message = "Dados inválidos";
        details = getValidationDetails(error);
      } else {
        const prismaCode = getPrismaErrorCode(error);
        if (prismaCode === "P2002") {
          statusCode = 409;
          code = "CONFLICT";
          message = "Registro já existe no sistema";
        } else if (prismaCode === "P2025") {
          statusCode = 404;
          code = "NOT_FOUND";
          message = "Registro não encontrado";
        } else if (
          typeof error.statusCode === "number" &&
          error.statusCode >= 400 &&
          error.statusCode < 600
        ) {
          statusCode = error.statusCode;
          code = typeof error.code === "string" ? error.code : "HTTP_ERROR";
          message =
            isProduction && statusCode >= 500
              ? "Erro interno do servidor"
              : error.message;
        }
      }

      reply.status(statusCode).send({
        statusCode,
        code,
        error: message,
        message,
        ...(details ? { details } : {}),
      });
    }
  );
}
