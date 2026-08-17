import { describe, expect, it } from "vitest";

import {
  createSettingsService,
  type SettingsService,
} from "../../services/settings-service.js";
import type {
  Destination,
  SystemSettings,
} from "@prisma/client";

type SettingsRow = { settingKey: string; settingValue: string | null };
type DestinationRow = { id: number; name: string; isDefault: boolean };

function fakeSettingsRepository() {
  const settings = new Map<string, string | null>();
  let nextId = 1;
  const destinations: DestinationRow[] = [];

  return {
    state: { settings, destinations },
    repository: {
      async getByKeys(keys: string[]) {
        return Array.from(settings.entries())
          .filter(([key]) => keys.includes(key))
          .map(
            ([settingKey, settingValue]) =>
              ({ settingKey, settingValue } as SystemSettings)
          );
      },
      async getAll() {
        return Array.from(settings.entries()).map(
          ([settingKey, settingValue]) =>
            ({ settingKey, settingValue } as SystemSettings)
        );
      },
      async set(key: string, value: string | null) {
        settings.set(key, value);
        return { settingKey: key, settingValue: value } as SystemSettings;
      },
      async listDestinations() {
        return destinations.map((d) => d) as Destination[];
      },
      async createDestination(name: string) {
        if (destinations.some((d) => d.name === name)) {
          throw { code: "P2002" };
        }
        const row: DestinationRow = { id: nextId++, name, isDefault: false };
        destinations.push(row);
        return row as unknown as Destination;
      },
      async deleteDestination(name: string) {
        const index = destinations.findIndex((d) => d.name === name);
        if (index === -1) throw { code: "P2025" };
        const [removed] = destinations.splice(index, 1);
        return removed as unknown as Destination;
      },
      async deleteCustomDestinations() {
        for (let i = destinations.length - 1; i >= 0; i--) {
          if (!destinations[i].isDefault) destinations.splice(i, 1);
        }
        return { count: 0 };
      },
    },
  };
}

describe("settings-service", () => {
  it("returns default colors when nothing is stored", async () => {
    const { repository } = fakeSettingsRepository();
    const service: SettingsService = createSettingsService({ repository });

    await expect(service.getColors()).resolves.toEqual({
      primaryColor: "#dc2626",
      secondaryColor: "#991b1b",
    });
  });

  it("returns stored colors overriding defaults", async () => {
    const fake = fakeSettingsRepository();
    await fake.repository.set("primary_color", "#000000");
    const service = createSettingsService({ repository: fake.repository });

    await expect(service.getColors()).resolves.toEqual({
      primaryColor: "#000000",
      secondaryColor: "#991b1b",
    });
  });

  it("persists updated colors", async () => {
    const fake = fakeSettingsRepository();
    const service = createSettingsService({ repository: fake.repository });

    await service.updateColors({ primaryColor: "#111111", secondaryColor: "#222222" });

    expect(fake.state.settings.get("primary_color")).toBe("#111111");
    expect(fake.state.settings.get("secondary_color")).toBe("#222222");
  });

  it("updates only the provided colors", async () => {
    const fake = fakeSettingsRepository();
    const service = createSettingsService({ repository: fake.repository });

    await service.updateColors({ secondaryColor: "#333333" });

    expect(fake.state.settings.has("primary_color")).toBe(false);
    expect(fake.state.settings.get("secondary_color")).toBe("#333333");
  });

  it("returns default system settings when nothing is stored", async () => {
    const { repository } = fakeSettingsRepository();
    const service = createSettingsService({ repository });

    await expect(service.getSystemSettings()).resolves.toEqual({
      pageTitle: "Guarda - 6° RCB",
      logo: "/img/logo.png",
      background: "/img/bg-cover.jpg",
    });
  });

  it("returns stored system settings overriding defaults", async () => {
    const fake = fakeSettingsRepository();
    await fake.repository.set("page_title", "Portaria");
    const service = createSettingsService({ repository: fake.repository });

    await expect(service.getSystemSettings()).resolves.toEqual({
      pageTitle: "Portaria",
      logo: "/img/logo.png",
      background: "/img/bg-cover.jpg",
    });
  });

  it("persists updated system settings", async () => {
    const fake = fakeSettingsRepository();
    const service = createSettingsService({ repository: fake.repository });

    await service.updateSystemSettings({ pageTitle: "OM 42", logo: "/system-images/logo.png" });

    expect(fake.state.settings.get("page_title")).toBe("OM 42");
    expect(fake.state.settings.get("logo_path")).toBe("/system-images/logo.png");
    expect(fake.state.settings.has("background_path")).toBe(false);
  });

  it("resets system settings to defaults", async () => {
    const fake = fakeSettingsRepository();
    await fake.repository.set("page_title", "Custom");
    const service = createSettingsService({ repository: fake.repository });

    const result = await service.resetSystemSettings();

    expect(result).toEqual({
      pageTitle: "Guarda - 6° RCB",
      logo: "/img/logo.png",
      background: "/img/bg-cover.jpg",
    });
  });

  it("lists destinations", async () => {
    const fake = fakeSettingsRepository();
    await fake.repository.createDestination("S2");
    await fake.repository.createDestination("PCM");
    const service = createSettingsService({ repository: fake.repository });

    await expect(service.listDestinations()).resolves.toEqual(["S2", "PCM"]);
  });

  it("adds a destination and returns the updated list", async () => {
    const fake = fakeSettingsRepository();
    const service = createSettingsService({ repository: fake.repository });

    await expect(service.addDestination({ name: "CIA MANUT" })).resolves.toEqual([
      "CIA MANUT",
    ]);
    expect(fake.state.destinations).toHaveLength(1);
  });

  it("throws 409 when adding a duplicated destination", async () => {
    const fake = fakeSettingsRepository();
    await fake.repository.createDestination("S2");
    const service = createSettingsService({ repository: fake.repository });

    await expect(service.addDestination({ name: "S2" })).rejects.toMatchObject({
      statusCode: 409,
      code: "CONFLICT",
    });
  });

  it("deletes a destination and returns the updated list", async () => {
    const fake = fakeSettingsRepository();
    await fake.repository.createDestination("S2");
    await fake.repository.createDestination("PCM");
    const service = createSettingsService({ repository: fake.repository });

    await expect(service.deleteDestination({ name: "S2" })).resolves.toEqual([
      "PCM",
    ]);
  });

  it("throws 404 when deleting an unknown destination", async () => {
    const fake = fakeSettingsRepository();
    const service = createSettingsService({ repository: fake.repository });

    await expect(service.deleteDestination({ name: "X" })).rejects.toMatchObject({
      statusCode: 404,
      code: "NOT_FOUND",
    });
  });
});