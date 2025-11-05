import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
import { genSaltSync, hash } from "bcrypt";

const envs = {
  JWT_SECRET: process.env.JWT_SECRET || "8bec-selva-brasil",
};

const hashPassword = (password) => {
  let salt = genSaltSync(10);
  return new Promise((res) => {
    hash(password, salt, (err, saltedPassword) => {
      res(saltedPassword);
    });
  });
};

async function main() {
  const password = await hashPassword("teste");

  const firstUser = await prisma.user.upsert({
    where: { login: "teste" },
    update: {},
    create: {
      login: "teste",
      role: "S2",
      password: password,
    },
  });

  return firstUser;
}

try {
  await main();
  await prisma.$disconnect();
} catch (error) {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
}
