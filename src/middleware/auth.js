import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// // Adicione esta linha para re-exportar a função
// export { verifyToken };

export const verifyToken = async (request, reply) => {
  try {
    // 🔒 PRIORIDADE: Cookie primeiro, depois header
    let token = request.cookies?.accessToken;

    // Fallback para header Authorization (compatibilidade)
    if (!token) {
      const auth = request.headers["authorization"];
      if (auth) {
        token = auth.replace("Bearer ", "");
      }
    }

    if (!token) {
      return reply.status(401).send({
        error: "Token de acesso não fornecido",
      });
    }

    // Verificar se JWT_SECRET existe
    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET não configurado!");
      return reply
        .status(500)
        .send({ error: "Erro de configuração do servidor" });
    }

    // Decodificar e verificar o token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Verificar se o usuário ainda existe no banco
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, login: true, role: true },
    });

    if (!user) {
      return reply.status(401).send({
        error: "Usuário não encontrado",
      });
    }

    request.user = user;
  } catch (error) {
    console.log("Erro JWT:", error.message);

    if (error.name === "TokenExpiredError") {
      return reply.status(401).send({ error: "Token expirado" });
    }

    if (error.name === "JsonWebTokenError") {
      return reply.status(401).send({ error: "Token inválido" });
    }

    return reply
      .status(401)
      .send({ error: "Não autorizado", message: error.message, token: token });
  }
};

export const validateRequest = async (req, res) => {
  try {
    const auth = req.headers["authorization"];
    const token = auth?.replace("Bearer ", "");

    const user = await verifyToken(token);
    req.user = user;
  } catch (error) {
    return res.status(401).send({ error: "Não autorizado" });
  }
};

// Middleware específico para S2
export const verifyS2Role = async (request, reply) => {
  try {
    // Primeiro verificar o token
    await verifyToken(request, reply);

    // Se chegou até aqui, token é válido, verificar role
    if (request.user && request.user.role !== "S2") {
      return reply.status(403).send({
        error: "Acesso negado. Apenas usuários S2 podem acessar este recurso.",
      });
    }
  } catch (error) {
    // Erro já tratado no verifyToken
    return;
  }
};

// Middleware para Guarda // provavel nao esta sendo usada
export const verifyGuardaRoleController = async (request, reply) => {
  console.log("🔍 verifyGuardaRole - Usuário:", request.user);

  if (!request.user) {
    console.log("❌ Usuário não encontrado no request");
    throw new Error("Usuário não autenticado");
  }

  const allowedRoles = ["GUARDA", "S2", "SFPC"];

  if (!allowedRoles.includes(request.user.role)) {
    console.log(`❌ Role '${request.user.role}' não permitida para entrada`);
    throw new Error(
      `Role '${request.user.role}' não tem permissão para registrar entradas`
    );
  }

  console.log("✅ verifyGuardaRole - Permissão concedida");
};

export const verifyGuardaRole = async (request, reply) => {
  try {
    await verifyToken(request, reply);

    if (request.user && !["Guarda", "S2", "Scmt"].includes(request.user.role)) {
      return reply.status(403).send({
        error: "Acesso negado. Permissão insuficiente.",
      });
    }
  } catch (error) {
    return;
  }
};
