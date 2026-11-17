const { storeRepository } = require('../repositories/storeRepository');

/**
 * Persists a structured security/transaction audit record.
 * @param {{ id_usuario?: number|null, accion: string, entidad: string, entidad_id?: string|number, detalles?: object }} entry
 * @param {object} [repo=storeRepository]
 */
async function logAudit(entry, repo = storeRepository) {
  return repo.createAuditLog({
    id_usuario: entry.id_usuario ?? null,
    accion: entry.accion,
    entidad: entry.entidad,
    entidad_id: entry.entidad_id ?? '',
    detalles: entry.detalles || {},
  });
}

/**
 * Lists the most recent audit trail entries for administrative inspection.
 * @param {number} [limit=50]
 * @param {object} [repo=storeRepository]
 */
async function listAuditLogs(limit = 50, repo = storeRepository) {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  return repo.listAuditLogs(safeLimit);
}

module.exports = {
  logAudit,
  listAuditLogs,
};
