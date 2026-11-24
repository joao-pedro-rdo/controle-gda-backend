import { describe, expect, it } from "vitest";

import {
  createSettingsService,
  type SettingsService,
} from "../../services/settings-service.js";
import type { Destination } from "@prisma/client";

type DestinationRow = { id: number; name: string; isDefault: boolean };

function fakeSettingsRepository() {
  let nextId = 1;
  const destinations: DestinationRow[] = [];

  return {
    state: { destinations },
    repository: {
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