import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";

import {
  decryptBuffer,
  decryptImage,
  encryptBuffer,
  encryptImage,
} from "../../helpers/imageEncryption.js";

const original = process.env.IMAGE_ENCRYPTION_KEY;

afterEach(() => {
  if (original === undefined) delete process.env.IMAGE_ENCRYPTION_KEY;
  else process.env.IMAGE_ENCRYPTION_KEY = original;
});

// Gera um arquivo no formato legado (IV + AES-256-CBC) com a chave informada.
function legacyEncrypt(data: Buffer, key: Buffer): Buffer {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  return Buffer.concat([iv, cipher.update(data), cipher.final()]);
}

describe("image encryption", () => {
  const image = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5]);

  it("round-trips a buffer", () => {
    expect(decryptBuffer(encryptBuffer(image))).toEqual(image);
  });

  it("reads files encrypted with IMAGE_ENCRYPTION_KEY (first 32 chars)", () => {
    process.env.IMAGE_ENCRYPTION_KEY = "0123456789abcdef0123456789abcdefIGNORED";
    const legacy = legacyEncrypt(image, Buffer.from("0123456789abcdef0123456789abcdef", "utf8"));
    expect(decryptBuffer(legacy)).toEqual(image);
  });

  it("reads files encrypted with the key derived from JWT_SECRET", () => {
    delete process.env.IMAGE_ENCRYPTION_KEY;
    const key = crypto.scryptSync(process.env.JWT_SECRET as string, "image-salt-2025", 32);
    expect(decryptBuffer(legacyEncrypt(image, key))).toEqual(image);
  });

  it("encrypts a file in place and decrypts it back", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "img-"));
    const file = path.join(dir, "foto.jpg");
    fs.writeFileSync(file, image);

    const encryptedPath = encryptImage(file);

    expect(encryptedPath).toBe(`${file}.encrypted`);
    expect(fs.existsSync(file)).toBe(false);
    expect(decryptImage(encryptedPath)).toEqual(image);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
