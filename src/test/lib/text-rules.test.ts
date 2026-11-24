import { describe, expect, it } from "vitest";

import {
  cpfDigits,
  longText,
  optionalCnhDigits,
  personName,
  phoneText,
  shortText,
} from "../../lib/text-rules.js";
import { createVehicleSchema } from "../../schemas/vehicles-schema.js";
import { createPermissionarioSchema } from "../../schemas/permissionario-schema.js";
import { createPessoaNaoAutorizadaSchema } from "../../schemas/pessoa-nao-autorizada-schema.js";

describe("text rules", () => {
  describe("personName", () => {
    const name = personName("Nome", 150);

    it.each(["João da Conceição", "Maria D'Ávila", "Ana-Lúcia S. Gonçalves"])(
      "accepts %s",
      (value) => {
        expect(name.safeParse(value).success).toBe(true);
      }
    );

    it.each(["João <b>", "Maria; DROP", "Ana{1}", "Pedro$", "José2"])(
      "rejects %s",
      (value) => {
        expect(name.safeParse(value).success).toBe(false);
      }
    );
  });

  describe("shortText", () => {
    const text = shortText("Campo", 50);

    it.each(["3º Sgt Silva", "2ª Seção", "Gol 1.0/G5 (prata)", "S&M", ""])(
      "accepts %s",
      (value) => {
        expect(text.safeParse(value).success).toBe(true);
      }
    );

    it.each(["<script>", "a|b", "a\\b", "`cmd`", "a{b}", "a;b"])("rejects %s", (value) => {
      expect(text.safeParse(value).success).toBe(false);
    });
  });

  it("longText allows sentence punctuation but not markup", () => {
    const text = longText("Obs", 500);
    expect(text.safeParse('Visto em 10/01: "atenção"! 100% ok?').success).toBe(true);
    expect(text.safeParse("<img src=x>").success).toBe(false);
  });

  it("phoneText accepts masked numbers only", () => {
    const phone = phoneText("Telefone", 30);
    expect(phone.safeParse("(61) 99999-0000").success).toBe(true);
    expect(phone.safeParse("ramal abc").success).toBe(false);
  });

  describe("cpfDigits", () => {
    it("accepts masked or raw CPF and returns digits", () => {
      expect(cpfDigits.parse("529.982.247-25")).toBe("52998224725");
      expect(cpfDigits.parse("52998224725")).toBe("52998224725");
    });

    it.each([
      ["letters", "529.982.247-2A", "CPF deve conter apenas números"],
      ["short", "529.982.247", "CPF deve ter 11 dígitos"],
      ["wrong check digit", "529.982.247-26", "CPF inválido"],
      ["empty", "", "CPF obrigatório"],
    ])("rejects %s", (_label, value, message) => {
      const result = cpfDigits.safeParse(value);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.map((issue) => issue.message)).toContain(message);
      }
    });
  });

  describe("optionalCnhDigits", () => {
    it("accepts empty or 11 digits and returns digits", () => {
      expect(optionalCnhDigits.parse("")).toBe("");
      expect(optionalCnhDigits.parse("0123 4567 890")).toBe("01234567890");
    });

    it.each(["1234567890", "123456789012", "1234567890A", "11111111111"])(
      "rejects %s",
      (value) => {
        expect(optionalCnhDigits.safeParse(value).success).toBe(false);
      }
    );
  });
});

describe("schemas using text rules", () => {
  const vehicle = {
    completeName: "João da Silva",
    tagName: "3º Sgt Silva",
    carModel: "Gol",
    licensePlate: "ABC1D23",
    color: "Prata",
    driverLicense: "01234567890",
    idNumber: "529.982.247-25",
    company: "1º Esqd",
    section: "S2",
  };

  it("vehicle stores CPF and CNH as digits", () => {
    expect(createVehicleSchema.parse(vehicle)).toMatchObject({
      idNumber: "52998224725",
      driverLicense: "01234567890",
    });
  });

  it.each([
    ["completeName", "João <script>"],
    ["color", "Prata;"],
    ["driverLicense", "123"],
    ["idNumber", "abc"],
  ])("vehicle rejects invalid %s", (field, value) => {
    expect(createVehicleSchema.safeParse({ ...vehicle, [field]: value }).success).toBe(false);
  });

  it("permissionario rejects an invalid optional plate", () => {
    const result = createPermissionarioSchema.safeParse({
      completeName: "Maria Souza",
      idNumber: "0123456789",
      CPF: "529.982.247-25",
      licensePlate: "XX",
    });
    expect(result.success).toBe(false);
  });

  it("pessoa nao autorizada rejects markup in observacao", () => {
    const result = createPessoaNaoAutorizadaSchema.safeParse({
      nome: "Fulano de Tal",
      CPF: "529.982.247-25",
      observacao: "<b>perigoso</b>",
    });
    expect(result.success).toBe(false);
  });
});
