import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { PrismaClient } = require("@prisma/client");
import { compare, genSaltSync, hash } from "bcrypt";
import jwt from "jsonwebtoken";

export const envs = {
  //! Ajuster a palavra chave do webtoken
  JWT_SECRET: process.env.JWT_SECRET || "8bec-selva-brasil",
};

export const prisma = new PrismaClient();

export const hashPassword = (password) => {
  let salt = genSaltSync(10);
  return new Promise((res) => {
    hash(password, salt, (err, saltedPassword) => {
      res(saltedPassword);
    });
  });
};

export const comparePassword = (password, hashedPassword) => {
  return new Promise((res) => {
    compare(password, hashedPassword, (err, same) => {
      if (err) res(false);
      else res(same);
    });
  });
};

export const createAccessToken = async (user) => {
  try {
    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET não configurado");
    }

    const payload = {
      id: user.id,
      login: user.login,
      role: user.role,
    };

    // Token expira em 8 horas
    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: "8h",
      issuer: "controle-gda",
      audience: "controle-gda-users",
    });

    return token;
  } catch (error) {
    console.error("Erro ao criar token:", error);
    throw error;
  }
};

export const verifyToken = (token) => {
  return new Promise((res, rej) => {
    if (!token) {
      rej("invalid token");
      return;
    }
    jwt.verify(token, envs.JWT_SECRET, {}, (err, decoded) => {
      if (err) {
        rej("invalid token");
        return;
      }
      res(decoded);
    });
  });
};

// Função para refresh token (opcional)
export const createRefreshToken = async (user) => {
  const payload = {
    id: user.id,
    type: "refresh",
  };

  return jwt.sign(
    payload,
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    {
      expiresIn: "7d",
    }
  );
};
