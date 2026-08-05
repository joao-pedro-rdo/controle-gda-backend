import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const routeState = vi.hoisted(() => ({
  vehicles: new Map<
    number,
    {
      id: number;
      completeName: string;
      tagName: string;
      carModel: string;
      licensePlate: string;
      color: string;
      driverLicense: string;
      idNumber: string;
      company: string;
      section: string;
    }
  >(),
  nextId: 1,
}));

type VehicleRow = NonNullable<
  ReturnType<typeof routeState.vehicles.get>
>;

vi.mock("../../repositories/vehicle-repository.js", () => {
  return {
    prismaVehicleRepository: {
      async findMany() {
        return Array.from(routeState.vehicles.values());
      },
      async findById(id: number) {
        return routeState.vehicles.get(id) ?? null;
      },
      async findByPlate(licensePlate: string) {
        return (
          Array.from(routeState.vehicles.values()).find(
            (vehicle) => vehicle.licensePlate === licensePlate
          ) ?? null
        );
      },
      async create(data: Record<string, unknown>) {
        const vehicle = { id: routeState.nextId++, ...data } as VehicleRow;
        routeState.vehicles.set(vehicle.id, vehicle);
        return vehicle;
      },
      async update(
        id: number,
        data: Partial<{
          completeName: string;
          tagName: string;
          carModel: string;
          licensePlate: string;
          color: string;
          driverLicense: string;
          idNumber: string;
          company: string;
          section: string;
        }>
      ) {
        const vehicle = routeState.vehicles.get(id);
        if (!vehicle) throw { code: "P2025" };
        Object.assign(vehicle, data);
        return vehicle;
      },
      async remove(id: number) {
        const vehicle = routeState.vehicles.get(id);
        if (!vehicle) throw { code: "P2025" };
        routeState.vehicles.delete(id);
        return vehicle;
      },
    },
  };
});

vi.mock("../../repositories/user-repository.js", () => {
  return {
    prismaUserRepository: {
      async findById(id: number) {
        const users: Record<
          number,
          { id: number; login: string; password: string; role: string }
        > = {
          1: { id: 1, login: "s2", password: "x", role: "S2" },
          2: { id: 2, login: "guarda", password: "x", role: "Guarda" },
        };
        return users[id] ?? null;
      },
    },
  };
});

import { signAccessToken } from "../../lib/auth.js";
import { createTestApp } from "../helpers/create-test-app.js";

const s2Token = signAccessToken({ id: 1, login: "s2", role: "S2" });
const guardaToken = signAccessToken({ id: 2, login: "guarda", role: "Guarda" });

const validBody = {
  completeName: "João da Silva",
  tagName: "Cap Silva",
  carModel: "Gol",
  licensePlate: "ABC1D23",
  color: "Prata",
  driverLicense: "12345678901",
  idNumber: "529.982.247-25",
  company: "1º Esqd",
  section: "CIA MANUT",
};

describe("vehicles routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(() => {
    routeState.vehicles.clear();
    routeState.nextId = 1;
    routeState.vehicles.set(1, {
      id: 1,
      completeName: "Maria Souza",
      tagName: "Ten Souza",
      carModel: "Onix",
      licensePlate: "XYZ2B34",
      color: "Preto",
      driverLicense: "98765432109",
      idNumber: "111.444.777-35",
      company: "2º Esqd",
      section: "CIA ADM",
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("lists vehicles without authentication", async () => {
    const response = await app.inject({ method: "GET", url: "/vehicles" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveLength(1);
    expect(response.json()[0]).toMatchObject({ id: 1, licensePlate: "XYZ2B34" });
  });

  it("returns a vehicle by id without authentication", async () => {
    const response = await app.inject({ method: "GET", url: "/vehicles/1" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ id: 1, completeName: "Maria Souza" });
  });

  it("returns 404 when vehicle by id is not found", async () => {
    const response = await app.inject({ method: "GET", url: "/vehicles/999" });

    expect(response.statusCode).toBe(404);
    expect(response.json().code).toBe("NOT_FOUND");
  });

  it("returns a vehicle by license plate without authentication", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/vehiclebyplate/XYZ2B34",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ id: 1, licensePlate: "XYZ2B34" });
  });

  it("looks up a vehicle by plate case/mask-insensitively", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/vehiclebyplate/xyz-2b34",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ id: 1, licensePlate: "XYZ2B34" });
  });

  it("returns 404 when plate lookup finds nothing", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/vehiclebyplate/ZZZ9999",
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().code).toBe("NOT_FOUND");
  });

  it("rejects create without authentication", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/vehicles",
      payload: validBody,
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().code).toBe("UNAUTHORIZED");
  });

  it("rejects create for a non-S2 profile", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/vehicles",
      cookies: { accessToken: guardaToken },
      payload: validBody,
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().code).toBe("FORBIDDEN");
  });

  it("creates a vehicle with S2 and returns 201", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/vehicles",
      cookies: { accessToken: s2Token },
      payload: validBody,
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      completeName: "João da Silva",
      licensePlate: "ABC1D23",
    });
    expect(response.json().idNumber).toBe("529.982.247-25");
  });

  it("rejects create with a duplicated plate (409)", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/vehicles",
      cookies: { accessToken: s2Token },
      payload: { ...validBody, licensePlate: "xyz-2b34" },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().code).toBe("CONFLICT");
    expect(routeState.vehicles.size).toBe(1);
  });

  it("rejects create with an invalid body (400)", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/vehicles",
      cookies: { accessToken: s2Token },
      payload: { completeName: "X" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe("VALIDATION_ERROR");
  });

  it("rejects create with an invalid plate (400)", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/vehicles",
      cookies: { accessToken: s2Token },
      payload: { ...validBody, licensePlate: "PLACA-INVALIDA-AQUI" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe("VALIDATION_ERROR");
  });

  it("rejects create with an invalid CPF (400)", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/vehicles",
      cookies: { accessToken: s2Token },
      payload: { ...validBody, idNumber: "123.456.789-00" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe("VALIDATION_ERROR");
  });

  it("updates a vehicle with S2 (200)", async () => {
    const response = await app.inject({
      method: "PATCH",
      url: "/vehicles/1",
      cookies: { accessToken: s2Token },
      payload: { color: "Azul" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ id: 1, color: "Azul" });
  });

  it("returns 404 when updating a nonexistent vehicle", async () => {
    const response = await app.inject({
      method: "PATCH",
      url: "/vehicles/999",
      cookies: { accessToken: s2Token },
      payload: { color: "Azul" },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().code).toBe("NOT_FOUND");
  });

  it("deletes a vehicle with S2 (200)", async () => {
    const response = await app.inject({
      method: "DELETE",
      url: "/vehicles/1",
      cookies: { accessToken: s2Token },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ id: 1 });
  });
});
