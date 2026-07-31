import { ZodError } from "zod";

export type ErrorField = { field: string; message: string };
export type ErrorDetails = ErrorField[];

export interface AppErrorOptions {
  details?: ErrorDetails;
  expose?: boolean;
  cause?: unknown;
}

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: ErrorDetails;
  readonly expose: boolean;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    options: AppErrorOptions = {}
  ) {
    super(message, { cause: options.cause });
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = options.details;
    this.expose = options.expose ?? statusCode < 500;
  }

  get isOperational(): boolean {
    return this.statusCode < 500;
  }
}

export function badRequest(
  message: string,
  options?: AppErrorOptions
): AppError {
  return new AppError(400, "BAD_REQUEST", message, options);
}

export function unauthorized(
  message = "Não autorizado",
  options?: AppErrorOptions
): AppError {
  return new AppError(401, "UNAUTHORIZED", message, options);
}

export function forbidden(
  message = "Acesso negado",
  options?: AppErrorOptions
): AppError {
  return new AppError(403, "FORBIDDEN", message, options);
}

export function notFound(
  message = "Recurso não encontrado",
  options?: AppErrorOptions
): AppError {
  return new AppError(404, "NOT_FOUND", message, options);
}

export function conflict(
  message = "Registro já existe",
  options?: AppErrorOptions
): AppError {
  return new AppError(409, "CONFLICT", message, options);
}

export function unprocessable(
  message = "Dados inválidos",
  options?: AppErrorOptions
): AppError {
  return new AppError(422, "UNPROCESSABLE_ENTITY", message, options);
}

export function internal(
  message = "Erro interno do servidor",
  options?: AppErrorOptions
): AppError {
  return new AppError(500, "INTERNAL_ERROR", message, options);
}

export function fromZodError(error: ZodError): AppError {
  const details: ErrorDetails = error.issues.map((issue) => ({
    field: issue.path.join(".") || "unknown",
    message: issue.message,
  }));

  return new AppError(400, "VALIDATION_ERROR", "Dados inválidos", { details });
}
