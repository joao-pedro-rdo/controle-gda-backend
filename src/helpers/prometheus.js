/**
 * 📊 PROMETHEUS METRICS - Sistema de Controle GDA
 * 
 * Este arquivo configura todas as métricas do Prometheus para o sistema.
 * Inclui métricas HTTP automáticas e métricas de negócio customizadas.
 */

import client from 'prom-client';

// ============================================================================
// CONFIGURAÇÃO DO REGISTRO
// ============================================================================

// Criar registro personalizado
const register = new client.Registry();

// Adicionar métricas padrão do Node.js (memória, CPU do processo, etc)
client.collectDefaultMetrics({
  register,
  prefix: 'nodejs_',
});

// ============================================================================
// MÉTRICAS HTTP (Performance e Disponibilidade)
// ============================================================================

/**
 * Contador de requisições HTTP totais
 * Labels: method, path, status
 */
export const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total de requisições HTTP recebidas',
  labelNames: ['method', 'path', 'status'],
  registers: [register],
});

/**
 * Histograma de duração das requisições HTTP (em segundos)
 * Labels: method, path, status
 * Buckets: 0.1s, 0.5s, 1s, 2s, 5s, 10s
 */
export const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duração das requisições HTTP em segundos',
  labelNames: ['method', 'path', 'status'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
  registers: [register],
});

// ============================================================================
// MÉTRICAS DE NEGÓCIO - ENTRADAS E SAÍDAS
// ============================================================================

/**
 * Contador de ENTRADAS registradas no sistema
 * Labels:
 * - type: "visitor" | "permissionario" | "militar"
 * - status: "success" | "error"
 * - scheduled: "true" | "false" (se foi agendamento)
 */
export const entriesTotal = new client.Counter({
  name: 'entries_total',
  help: 'Total de entradas registradas no sistema (visitantes, permissionários e militares)',
  labelNames: ['type', 'status', 'scheduled'],
  registers: [register],
});

/**
 * Contador de SAÍDAS registradas
 * Labels: type (visitor/permissionario/militar)
 */
export const exitsTotal = new client.Counter({
  name: 'exits_total',
  help: 'Total de saídas registradas no sistema',
  labelNames: ['type'],
  registers: [register],
});

/**
 * Contador de AGENDAMENTOS criados
 * Labels: status (created/confirmed/cancelled)
 */
export const scheduledEntriesTotal = new client.Counter({
  name: 'scheduled_entries_total',
  help: 'Total de agendamentos de visitas criados',
  labelNames: ['status'],
  registers: [register],
});

/**
 * Histograma de tempo de permanência (em horas)
 * Mede quanto tempo as pessoas ficam no local
 */
export const stayDurationHours = new client.Histogram({
  name: 'stay_duration_hours',
  help: 'Tempo de permanência no local em horas',
  labelNames: ['type'],
  buckets: [0.5, 1, 2, 4, 8, 12, 24],
  registers: [register],
});

// ============================================================================
// MÉTRICAS DE NEGÓCIO - CADASTROS
// ============================================================================

/**
 * Gauge: Total de veículos cadastrados
 * (Atualizado periodicamente)
 */
export const vehiclesRegisteredTotal = new client.Gauge({
  name: 'vehicles_registered_total',
  help: 'Total de veículos cadastrados no sistema',
  registers: [register],
});

/**
 * Gauge: Total de permissionários cadastrados
 */
export const permissionariosTotal = new client.Gauge({
  name: 'permissionarios_total',
  help: 'Total de permissionários cadastrados no sistema',
  registers: [register],
});

/**
 * Gauge: Total de pessoas não autorizadas
 */
export const unauthorizedPersonsTotal = new client.Gauge({
  name: 'unauthorized_persons_total',
  help: 'Total de pessoas não autorizadas cadastradas',
  registers: [register],
});

/**
 * Gauge: Total de usuários no sistema
 */
export const usersTotal = new client.Gauge({
  name: 'users_total',
  help: 'Total de usuários cadastrados no sistema',
  labelNames: ['role'],
  registers: [register],
});

/**
 * Contador de veículos cadastrados (incremental)
 */
export const vehiclesCreatedTotal = new client.Counter({
  name: 'vehicles_created_total',
  help: 'Total de veículos criados (contador incremental)',
  registers: [register],
});

// ============================================================================
// MÉTRICAS DE AUTENTICAÇÃO E SEGURANÇA
// ============================================================================

/**
 * Contador de tentativas de login
 * Labels:
 * - status: "success" | "failed"
 * - role: "S2" | "Guarda" | "Scmt"
 */
export const loginAttemptsTotal = new client.Counter({
  name: 'login_attempts_total',
  help: 'Total de tentativas de login no sistema',
  labelNames: ['status', 'role'],
  registers: [register],
});

/**
 * Gauge: Sessões ativas
 * Labels: role
 */
export const activeSessionsGauge = new client.Gauge({
  name: 'active_sessions',
  help: 'Número de sessões ativas no momento',
  labelNames: ['role'],
  registers: [register],
});

/**
 * Contador de consultas a pessoas não autorizadas
 */
export const unauthorizedPersonChecksTotal = new client.Counter({
  name: 'unauthorized_person_checks_total',
  help: 'Total de consultas a pessoas não autorizadas',
  labelNames: ['found'],
  registers: [register],
});

// ============================================================================
// MÉTRICAS DE UPLOADS E ARQUIVOS
// ============================================================================

/**
 * Contador de uploads de imagens
 * Labels:
 * - type: "visitor" | "permissionario" | "unauthorized" | "system_logo" | "system_background"
 * - status: "success" | "error"
 */
export const imageUploadsTotal = new client.Counter({
  name: 'image_uploads_total',
  help: 'Total de uploads de imagens realizados',
  labelNames: ['type', 'status'],
  registers: [register],
});

/**
 * Histograma de tamanho de uploads (em MB)
 */
export const uploadSizeBytes = new client.Histogram({
  name: 'upload_size_bytes',
  help: 'Tamanho dos arquivos enviados em bytes',
  labelNames: ['type'],
  buckets: [10000, 50000, 100000, 500000, 1000000, 5000000], // 10KB até 5MB
  registers: [register],
});

/**
 * Contador de importações CSV
 */
export const csvImportsTotal = new client.Counter({
  name: 'csv_imports_total',
  help: 'Total de importações CSV realizadas',
  labelNames: ['status', 'records_imported'],
  registers: [register],
});

// ============================================================================
// FUNÇÕES AUXILIARES PARA INCREMENTAR MÉTRICAS DE NEGÓCIO
// ============================================================================

/**
 * Incrementa contador de entradas
 * @param {string} type - "visitor" | "permissionario" | "militar"
 * @param {boolean} scheduled - Se é agendamento
 * @param {string} status - "success" | "error"
 */
export function incrementEntryCounter(type, scheduled = false, status = 'success') {
  entriesTotal.inc({
    type,
    status,
    scheduled: scheduled.toString(),
  });
}

/**
 * Incrementa contador de saídas
 * @param {string} type - "visitor" | "permissionario" | "militar"
 */
export function incrementExitCounter(type) {
  exitsTotal.inc({ type });
}

/**
 * Incrementa contador de agendamentos
 * @param {string} status - "created" | "confirmed" | "cancelled"
 */
export function incrementScheduledEntry(status) {
  scheduledEntriesTotal.inc({ status });
}

/**
 * Registra tempo de permanência
 * @param {string} type - "visitor" | "permissionario" | "militar"
 * @param {number} hours - Tempo em horas
 */
export function recordStayDuration(type, hours) {
  stayDurationHours.observe({ type }, hours);
}

/**
 * Incrementa tentativas de login
 * @param {string} status - "success" | "failed"
 * @param {string} role - "S2" | "Guarda" | "Scmt" | null
 */
export function incrementLoginAttempts(status, role = null) {
  loginAttemptsTotal.inc({
    status,
    role: role || 'unknown',
  });
}

/**
 * Incrementa upload de imagem
 * @param {string} type - "visitor" | "permissionario" | "unauthorized" | "system_logo" | "system_background"
 * @param {string} status - "success" | "error"
 * @param {number} sizeBytes - Tamanho do arquivo em bytes
 */
export function incrementImageUpload(type, status = 'success', sizeBytes = 0) {
  imageUploadsTotal.inc({ type, status });
  if (sizeBytes > 0 && status === 'success') {
    uploadSizeBytes.observe({ type }, sizeBytes);
  }
}

/**
 * Incrementa importação CSV
 * @param {string} status - "success" | "error"
 * @param {number} recordsImported - Número de registros importados
 */
export function incrementCsvImport(status, recordsImported = 0) {
  csvImportsTotal.inc({
    status,
    records_imported: recordsImported.toString(),
  });
}

/**
 * Incrementa contador de veículos criados
 */
export function incrementVehicleCreated() {
  vehiclesCreatedTotal.inc();
}

/**
 * Atualiza gauge de veículos totais
 * @param {number} count
 */
export function updateVehiclesGauge(count) {
  vehiclesRegisteredTotal.set(count);
}

/**
 * Atualiza gauge de permissionários
 * @param {number} count
 */
export function updatePermissionariosGauge(count) {
  permissionariosTotal.set(count);
}

/**
 * Atualiza gauge de pessoas não autorizadas
 * @param {number} count
 */
export function updateUnauthorizedPersonsGauge(count) {
  unauthorizedPersonsTotal.set(count);
}

/**
 * Atualiza gauge de usuários
 * @param {string} role
 * @param {number} count
 */
export function updateUsersGauge(role, count) {
  usersTotal.set({ role }, count);
}

/**
 * Incrementa consultas a pessoas não autorizadas
 * @param {boolean} found
 */
export function incrementUnauthorizedPersonCheck(found) {
  unauthorizedPersonChecksTotal.inc({ found: found.toString() });
}

// ============================================================================
// EXPORTAR REGISTRO
// ============================================================================

export { register };

export default {
  register,
  httpRequestsTotal,
  httpRequestDuration,
  entriesTotal,
  exitsTotal,
  incrementEntryCounter,
  incrementExitCounter,
  incrementLoginAttempts,
  incrementImageUpload,
  incrementVehicleCreated,
  updateVehiclesGauge,
  updatePermissionariosGauge,
};
