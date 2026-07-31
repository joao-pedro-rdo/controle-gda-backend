import "fastify";

declare module "fastify" {
  interface FastifyRequest {
    user?: {
      id: number;
      login: string;
      role: string;
    };
  }
}
