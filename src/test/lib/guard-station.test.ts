import { afterEach, describe, expect, it } from "vitest";

import {
  isGuardStationIp,
  normalizeIp,
  parseIpAllowlist,
  parseTrustProxy,
} from "../../lib/guard-station.js";

describe("guard station helpers", () => {
  const original = process.env.GUARDA_TRUSTED_IPS;

  afterEach(() => {
    if (original === undefined) delete process.env.GUARDA_TRUSTED_IPS;
    else process.env.GUARDA_TRUSTED_IPS = original;
  });

  describe("normalizeIp", () => {
    it("strips the IPv4-mapped IPv6 prefix", () => {
      expect(normalizeIp("::ffff:10.0.0.5")).toBe("10.0.0.5");
      expect(normalizeIp(" 10.0.0.5 ")).toBe("10.0.0.5");
      expect(normalizeIp("fe80::1")).toBe("fe80::1");
    });
  });

  describe("parseIpAllowlist", () => {
    it("returns null when nothing is configured", () => {
      expect(parseIpAllowlist(undefined)).toBeNull();
      expect(parseIpAllowlist("  ,  ")).toBeNull();
    });

    it("accepts single addresses and CIDR ranges", () => {
      const list = parseIpAllowlist("10.0.0.5, 192.168.10.0/24 fd00::/8");
      expect(list?.check("10.0.0.5", "ipv4")).toBe(true);
      expect(list?.check("10.0.0.6", "ipv4")).toBe(false);
      expect(list?.check("192.168.10.77", "ipv4")).toBe(true);
      expect(list?.check("192.168.11.1", "ipv4")).toBe(false);
      expect(list?.check("fd00::1", "ipv6")).toBe(true);
    });

    it.each(["guarita", "10.0.0.300", "10.0.0.0/33", "10.0.0.0/abc", "10.0.0.0/8/1"])(
      "rejects invalid entry %s",
      (entry) => {
        expect(() => parseIpAllowlist(entry)).toThrow(/GUARDA_TRUSTED_IPS/);
      }
    );
  });

  describe("isGuardStationIp", () => {
    it("is false when no allowlist is configured", () => {
      delete process.env.GUARDA_TRUSTED_IPS;
      expect(isGuardStationIp("10.0.0.5")).toBe(false);
    });

    it("matches IPv4-mapped addresses against the allowlist", () => {
      process.env.GUARDA_TRUSTED_IPS = "10.0.0.5";
      expect(isGuardStationIp("::ffff:10.0.0.5")).toBe(true);
      expect(isGuardStationIp("10.0.0.9")).toBe(false);
      expect(isGuardStationIp(undefined)).toBe(false);
      expect(isGuardStationIp("not-an-ip")).toBe(false);
    });

    it("picks up allowlist changes", () => {
      process.env.GUARDA_TRUSTED_IPS = "10.0.0.5";
      expect(isGuardStationIp("10.0.0.7")).toBe(false);
      process.env.GUARDA_TRUSTED_IPS = "10.0.0.7";
      expect(isGuardStationIp("10.0.0.7")).toBe(true);
    });
  });

  describe("parseTrustProxy", () => {
    it("disables proxy trust by default", () => {
      expect(parseTrustProxy(undefined)).toBe(false);
      expect(parseTrustProxy("")).toBe(false);
      expect(parseTrustProxy("false")).toBe(false);
    });

    it("accepts a hop count", () => {
      expect(parseTrustProxy("1")).toBe(1);
    });

    it("accepts a list of proxy addresses", () => {
      expect(parseTrustProxy("172.18.0.0/16, 10.0.0.1")).toEqual([
        "172.18.0.0/16",
        "10.0.0.1",
      ]);
    });

    it("refuses to trust every proxy", () => {
      expect(() => parseTrustProxy("true")).toThrow(/TRUST_PROXY/);
    });

    it("rejects invalid addresses", () => {
      expect(() => parseTrustProxy("nginx")).toThrow(/TRUST_PROXY/);
    });
  });
});
