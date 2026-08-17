import { describe, expect, it } from "vitest";

import {
  MAX_FILE_SIZE,
  contentTypeForExtension,
  isSafeFilename,
  normalizeSystemImageName,
  validateImageUpload,
} from "../../lib/upload-validation.js";

const jpegFile = { filename: "foto.jpg", mimetype: "image/jpeg", size: 1024 };

describe("validateImageUpload", () => {
  it("accepts a valid jpeg image", () => {
    const result = validateImageUpload(jpegFile);
    expect(result).toEqual({ ok: true, extension: ".jpg", mimeType: "image/jpeg" });
  });

  it("accepts a valid png, gif and webp with uppercase extension", () => {
    expect(validateImageUpload({ filename: "logo.PNG", mimetype: "image/png", size: 10 })).toEqual({
      ok: true,
      extension: ".png",
      mimeType: "image/png",
    });
    expect(validateImageUpload({ filename: "bg.GIF", mimetype: "image/gif", size: 10 })).toEqual({
      ok: true,
      extension: ".gif",
      mimeType: "image/gif",
    });
    expect(validateImageUpload({ filename: "bg.webp", mimetype: "image/webp", size: 10 })).toEqual({
      ok: true,
      extension: ".webp",
      mimeType: "image/webp",
    });
  });

  it("rejects a missing file", () => {
    const result = validateImageUpload(undefined as never);
    expect(result).toEqual({ ok: false, reason: "Nenhum arquivo enviado" });
  });

  it("rejects a non-image mime type", () => {
    const result = validateImageUpload({
      filename: "nota.pdf",
      mimetype: "application/pdf",
      size: 10,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a disallowed extension", () => {
    const result = validateImageUpload({
      filename: "codigo.exe",
      mimetype: "image/jpeg",
      size: 10,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects an oversized file", () => {
    const result = validateImageUpload({
      filename: "foto.jpg",
      mimetype: "image/jpeg",
      size: MAX_FILE_SIZE + 1,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a file without extension", () => {
    const result = validateImageUpload({
      filename: "foto",
      mimetype: "image/jpeg",
      size: 10,
    });
    expect(result.ok).toBe(false);
  });
});

describe("normalizeSystemImageName", () => {
  it("builds the standardized filename with the extension", () => {
    expect(normalizeSystemImageName("logo", ".png")).toBe("logo.png");
    expect(normalizeSystemImageName("bg-cover", ".jpg")).toBe("bg-cover.jpg");
  });
});

describe("contentTypeForExtension", () => {
  it("maps known extensions", () => {
    expect(contentTypeForExtension(".png")).toBe("image/png");
    expect(contentTypeForExtension(".gif")).toBe("image/gif");
    expect(contentTypeForExtension(".webp")).toBe("image/webp");
    expect(contentTypeForExtension(".jpg")).toBe("image/jpeg");
    expect(contentTypeForExtension(".jpeg")).toBe("image/jpeg");
  });

  it("falls back to jpeg for unknown extensions", () => {
    expect(contentTypeForExtension(".xyz")).toBe("image/jpeg");
  });
});

describe("isSafeFilename", () => {
  it("accepts a plain filename", () => {
    expect(isSafeFilename("logo.png")).toBe(true);
  });

  it("rejects path traversal attempts", () => {
    expect(isSafeFilename("..%2Flogo.png")).toBe(false);
    expect(isSafeFilename("a/../b.png")).toBe(false);
    expect(isSafeFilename("..\\logo.png")).toBe(false);
  });
});