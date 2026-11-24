// Criptografia das imagens de visitantes e permissionários em disco.
//
// Formato do arquivo `.encrypted`: IV (16 bytes) + dados AES-256-CBC.
// A derivação da chave NÃO pode mudar: imagens já gravadas deixariam de abrir.
import crypto from "crypto";
import fs from "fs";

const ALGORITHM = "aes-256-cbc";
const IV_LENGTH = 16;
const KEY_LENGTH = 32;

function getEncryptionKey(): Buffer {
  const keyFromEnv = process.env.IMAGE_ENCRYPTION_KEY;
  if (keyFromEnv && keyFromEnv.length >= 32) {
    return Buffer.from(keyFromEnv.substring(0, 32), "utf8");
  }
  const secret = process.env.JWT_SECRET || "controle-gda-fallback-secret";
  return crypto.scryptSync(secret, "image-salt-2025", KEY_LENGTH);
}

export function encryptBuffer(data: Buffer): Buffer {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  return Buffer.concat([iv, cipher.update(data), cipher.final()]);
}

export function decryptBuffer(encryptedData: Buffer): Buffer {
  const iv = encryptedData.subarray(0, IV_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
  return Buffer.concat([decipher.update(encryptedData.subarray(IV_LENGTH)), decipher.final()]);
}

// Criptografa o arquivo, grava `<arquivo>.encrypted` e remove o original.
export function encryptImage(imagePath: string): string {
  if (!fs.existsSync(imagePath)) {
    throw new Error(`Arquivo não encontrado: ${imagePath}`);
  }
  const encryptedPath = getEncryptedPath(imagePath);
  fs.writeFileSync(encryptedPath, encryptBuffer(fs.readFileSync(imagePath)));
  fs.unlinkSync(imagePath);
  return encryptedPath;
}

export function decryptImage(encryptedPath: string): Buffer {
  if (!fs.existsSync(encryptedPath)) {
    throw new Error(`Arquivo criptografado não encontrado: ${encryptedPath}`);
  }
  try {
    return decryptBuffer(fs.readFileSync(encryptedPath));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Falha na descriptografia da imagem: ${message}`);
  }
}

export function isEncryptedImage(filePath: string): boolean {
  return filePath.endsWith(".encrypted");
}

export function getEncryptedPath(originalPath: string): string {
  return `${originalPath}.encrypted`;
}
