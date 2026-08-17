import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createFsSystemImageStorage,
  createSystemImageService,
  type SystemImageService,
  type SystemImageStorage,
} from "../../services/system-image-service.js";

function fakeStorage(): SystemImageStorage & { files: string[]; buffers: Map<string, Buffer> } {
  const files: string[] = [];
  const buffers = new Map<string, Buffer>();
  return {
    files,
    buffers,
    async save(_type, filename, buffer) {
      files.push(filename);
      buffers.set(filename, buffer);
    },
    async removeMatching(prefix) {
      const removed: string[] = [];
      for (let i = files.length - 1; i >= 0; i--) {
        if (files[i].startsWith(prefix)) {
          removed.push(files[i]);
          buffers.delete(files[i]);
          files.splice(i, 1);
        }
      }
      return removed;
    },
    async listFileNames() {
      return [...files];
    },
    read(filename) {
      return buffers.get(filename) ?? null;
    },
  };
}

describe("system-image-service", () => {
  let service: SystemImageService;
  let storage: ReturnType<typeof fakeStorage>;

  beforeEach(() => {
    storage = fakeStorage();
    service = createSystemImageService(storage);
  });

  it("uploads a logo with a standardized filename", async () => {
    const result = await service.upload("logo", Buffer.from("img"), ".png");

    expect(result).toEqual({ url: "/system-images/logo.png", filename: "logo.png" });
    expect(storage.files).toEqual(["logo.png"]);
  });

  it("uploads a background with a standardized filename", async () => {
    const result = await service.upload("background", Buffer.from("img"), ".jpg");

    expect(result).toEqual({ url: "/system-images/bg-cover.jpg", filename: "bg-cover.jpg" });
  });

  it("replaces a previous logo when a new one is uploaded", async () => {
    await service.upload("logo", Buffer.from("old"), ".png");
    const result = await service.upload("logo", Buffer.from("new"), ".webp");

    expect(result.filename).toBe("logo.webp");
    expect(storage.files).toEqual(["logo.webp"]);
  });

  it("reports no custom images when the storage is empty", async () => {
    await expect(service.getCurrent()).resolves.toEqual({
      logo: null,
      background: null,
    });
  });

  it("reports current custom images when present", async () => {
    await service.upload("logo", Buffer.from("a"), ".png");
    await service.upload("background", Buffer.from("b"), ".jpg");

    await expect(service.getCurrent()).resolves.toEqual({
      logo: "/system-images/logo.png",
      background: "/system-images/bg-cover.jpg",
    });
  });

  it("reports only one of logo or background when the other is missing", async () => {
    await service.upload("background", Buffer.from("b"), ".jpg");

    await expect(service.getCurrent()).resolves.toEqual({
      logo: null,
      background: "/system-images/bg-cover.jpg",
    });
  });

  it("resets a single image type", async () => {
    await service.upload("logo", Buffer.from("a"), ".png");
    await service.upload("background", Buffer.from("b"), ".jpg");

    const removed = await service.reset("logo");

    expect(removed).toBe(1);
    await expect(service.getCurrent()).resolves.toEqual({
      logo: null,
      background: "/system-images/bg-cover.jpg",
    });
  });

  it("reads a stored image by filename", async () => {
    await service.upload("logo", Buffer.from([0xff, 0xd8]), ".jpg");

    await expect(service.read("logo.jpg")).resolves.toEqual(Buffer.from([0xff, 0xd8]));
  });

  it("returns null when reading a missing image", async () => {
    await expect(service.read("logo.png")).resolves.toBeNull();
  });

  it("returns null for a path traversal filename", async () => {
    await expect(service.read("../secret.png")).resolves.toBeNull();
  });
});

describe("fsSystemImageStorage", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sysimg-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("persists files on disk and lists them", async () => {
    const storage = createFsSystemImageStorage(tmpDir);

    await storage.save("background", "bg-cover.jpg", Buffer.from("data"));

    await expect(storage.listFileNames()).resolves.toEqual(["bg-cover.jpg"]);
    expect(storage.read("bg-cover.jpg")).toEqual(Buffer.from("data"));
  });

  it("removes only files matching the prefix", async () => {
    const storage = createFsSystemImageStorage(tmpDir);
    await storage.save("logo", "logo.png", Buffer.from("a"));
    await storage.save("background", "bg-cover.jpg", Buffer.from("b"));

    const removed = await storage.removeMatching("logo");
    const files = await storage.listFileNames();

    expect(removed).toEqual(["logo.png"]);
    expect(files).toEqual(["bg-cover.jpg"]);
  });

  it("ignores dotfiles when listing", async () => {
    const storage = createFsSystemImageStorage(tmpDir);
    fs.writeFileSync(path.join(tmpDir, ".gitkeep"), "");

    await expect(storage.listFileNames()).resolves.toEqual([]);
  });

  it("returns null when reading a missing file", () => {
    const storage = createFsSystemImageStorage(tmpDir);
    expect(storage.read("nope.png")).toBeNull();
  });
});