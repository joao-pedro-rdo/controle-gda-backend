import { compare, genSaltSync, hash } from "bcrypt";

const SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  const salt = genSaltSync(SALT_ROUNDS);
  return new Promise((resolve) => {
    hash(password, salt, (_err, encrypted) => resolve(encrypted));
  });
}

export async function comparePassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return new Promise((resolve) => {
    compare(password, hashedPassword, (err, same) => resolve(err ? false : same));
  });
}