// Arquivo: back/src/helpers/imageEncryption.js
import crypto from "crypto";
import fs from "fs";
import path from "path";

const ALGORITHM = "aes-256-cbc";
const IV_LENGTH = 16;
const KEY_LENGTH = 32;

const getEncryptionKey = () => {
  const keyFromEnv = process.env.IMAGE_ENCRYPTION_KEY;

  if (keyFromEnv && keyFromEnv.length >= 32) {
    return Buffer.from(keyFromEnv.substring(0, 32), "utf8");
  } else {
    const secret = process.env.JWT_SECRET || "controle-gda-fallback-secret";
    return crypto.scryptSync(secret, "image-salt-2025", KEY_LENGTH);
  }
};

// Criptografar imagem
export const encryptImage = (imagePath) => {
  try {
    console.log("🔒 Iniciando criptografia de:", imagePath);

    // Verificar se arquivo existe
    if (!fs.existsSync(imagePath)) {
      throw new Error(`Arquivo não encontrado: ${imagePath}`);
    }

    // Ler arquivo original
    const imageBuffer = fs.readFileSync(imagePath);
    console.log(`📊 Arquivo lido: ${imageBuffer.length} bytes`);

    // Gerar IV aleatório
    const iv = crypto.randomBytes(IV_LENGTH);
    console.log("🔑 IV gerado");

    // 🔧 USAR createCipheriv (método correto e atual)
    const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
    console.log("🔐 Cipher criado");

    // Criptografar
    const encrypted = Buffer.concat([
      cipher.update(imageBuffer),
      cipher.final(),
    ]);
    console.log(`🔒 Dados criptografados: ${encrypted.length} bytes`);

    // Combinar IV + dados criptografados
    const encryptedData = Buffer.concat([iv, encrypted]);

    // Gerar nome do arquivo criptografado
    const encryptedPath = imagePath + ".encrypted";
    console.log("📍 Caminho criptografado:", encryptedPath);

    // Salvar arquivo criptografado
    fs.writeFileSync(encryptedPath, encryptedData);
    console.log("💾 Arquivo criptografado salvo");

    // Remover arquivo original
    fs.unlinkSync(imagePath);
    console.log("🗑️ Arquivo original removido");

    console.log("✅ Criptografia concluída:", encryptedPath);
    return encryptedPath;
  } catch (error) {
    console.error("❌ Erro na criptografia:", error);
    throw error;
  }
};

// Descriptografar imagem
export const decryptImage = (encryptedPath) => {
  try {
    console.log("🔓 Descriptografando imagem:", encryptedPath);

    // Verificar se arquivo existe
    if (!fs.existsSync(encryptedPath)) {
      throw new Error(`Arquivo criptografado não encontrado: ${encryptedPath}`);
    }

    // Ler arquivo criptografado
    const encryptedData = fs.readFileSync(encryptedPath);
    console.log(`📊 Arquivo criptografado lido: ${encryptedData.length} bytes`);

    // 🔧 EXTRAIR IV E DADOS CRIPTOGRAFADOS (sem authTag para CBC)
    const iv = encryptedData.slice(0, IV_LENGTH);
    const encrypted = encryptedData.slice(IV_LENGTH);

    console.log(`🔑 IV extraído: ${iv.length} bytes`);
    console.log(`🔒 Dados criptografados: ${encrypted.length} bytes`);

    // 🔧 USAR createDecipheriv (método correto)
    const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
    console.log("🔓 Decipher criado");

    // Descriptografar
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    console.log(`✅ Imagem descriptografada: ${decrypted.length} bytes`);
    return decrypted;
  } catch (error) {
    console.error("❌ Erro ao descriptografar imagem:", error);
    throw new Error(`Falha na descriptografia da imagem: ${error.message}`);
  }
};

// Verificar se arquivo está criptografado
export const isEncryptedImage = (filePath) => {
  return filePath.endsWith(".encrypted");
};

// Obter caminho criptografado
export const getEncryptedPath = (originalPath) => {
  return originalPath + ".encrypted";
};
