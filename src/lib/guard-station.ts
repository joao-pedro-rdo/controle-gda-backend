// Posto da Guarda sem login.
//
// Máquinas cujo IP está em GUARDA_TRUSTED_IPS são autenticadas
// automaticamente como Guarda quando não há sessão válida. Um usuário que faça
// login nessas máquinas continua usando o próprio perfil.
//
// O IP considerado é `request.ip`, que só usa o X-Forwarded-For quando o
// Fastify confia no proxy (ver TRUST_PROXY em `parseTrustProxy`). Sem isso
// qualquer cliente poderia forjar o cabeçalho e se passar pelo posto.

import { BlockList, isIP } from "node:net";
import type { FastifyRequest } from "fastify";

import type { AuthUser } from "./auth.js";

export const GUARD_STATION_USER: Readonly<AuthUser> = Object.freeze({
  id: 0,
  login: "posto-guarda",
  role: "Guarda",
  station: true,
});

// Remove o prefixo IPv4 mapeado em IPv6 ("::ffff:10.0.0.5" -> "10.0.0.5").
export function normalizeIp(ip: string): string {
  const trimmed = ip.trim();
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(trimmed);
  return mapped ? mapped[1] : trimmed;
}

// Aceita IPs e faixas CIDR separados por vírgula ou espaço.
// Entradas inválidas derrubam a subida do servidor, para não haver um posto
// silenciosamente sem acesso (ou uma faixa mais larga que a pretendida).
export function parseIpAllowlist(raw: string | undefined): BlockList | null {
  const entries = (raw ?? "")
    .split(/[\s,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (entries.length === 0) return null;

  const list = new BlockList();
  for (const entry of entries) {
    const [address, prefixText, ...rest] = entry.split("/");
    const ip = normalizeIp(address);
    const family = isIP(ip);
    if (!family || rest.length > 0) {
      throw new Error(`GUARDA_TRUSTED_IPS: endereço inválido '${entry}'`);
    }
    const type = family === 4 ? "ipv4" : "ipv6";

    if (prefixText === undefined) {
      list.addAddress(ip, type);
      continue;
    }

    const prefix = Number(prefixText);
    const max = family === 4 ? 32 : 128;
    if (!/^\d+$/.test(prefixText) || prefix > max) {
      throw new Error(`GUARDA_TRUSTED_IPS: faixa inválida '${entry}'`);
    }
    list.addSubnet(ip, prefix, type);
  }
  return list;
}

let cachedRaw: string | undefined;
let cachedList: BlockList | null = null;

function getAllowlist(): BlockList | null {
  const raw = process.env.GUARDA_TRUSTED_IPS;
  if (raw !== cachedRaw) {
    cachedList = parseIpAllowlist(raw);
    cachedRaw = raw;
  }
  return cachedList;
}

export function isGuardStationIp(ip: string | undefined): boolean {
  if (!ip) return false;
  const list = getAllowlist();
  if (!list) return false;

  const normalized = normalizeIp(ip);
  const family = isIP(normalized);
  if (!family) return false;
  return list.check(normalized, family === 4 ? "ipv4" : "ipv6");
}

export function guardStationUserFor(request: FastifyRequest): AuthUser | null {
  return isGuardStationIp(request.ip) ? { ...GUARD_STATION_USER } : null;
}

// TRUST_PROXY controla quando o Fastify usa o X-Forwarded-For:
//   vazio/false  nunca (request.ip = conexão TCP)
//   número N     confia nos N proxies mais próximos (no Docker: 1, o Nginx)
//   lista        IPs/CIDRs dos proxies confiáveis, separados por vírgula
// `true` (confiar em qualquer origem) é recusado de propósito.
export function parseTrustProxy(
  raw: string | undefined
): false | number | string[] {
  const value = (raw ?? "").trim();
  if (value === "" || value.toLowerCase() === "false") return false;
  if (/^\d+$/.test(value)) return Number(value);
  if (value.toLowerCase() === "true") {
    throw new Error(
      "TRUST_PROXY=true permite forjar o IP do posto da Guarda; use o número de proxies (ex.: 1)"
    );
  }
  const entries = value
    .split(/[\s,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
  for (const entry of entries) {
    if (!isIP(normalizeIp(entry.split("/")[0]))) {
      throw new Error(`TRUST_PROXY: endereço inválido '${entry}'`);
    }
  }
  return entries;
}
