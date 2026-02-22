/**
 * Actions logging utility for audit trail
 */

import { db } from '../db/database.js'
import { randomUUID } from 'crypto'
import { createHash } from 'crypto'

export type ActionType =
  | 'template_applied'
  | 'template_created'
  | 'template_updated'
  | 'template_deleted'
  | 'task_created'
  | 'task_updated'
  | 'task_completed'
  | 'customer_synced'
  | 'order_synced'
  | 'suggestion_generated'

export type EntityType = 'task' | 'template' | 'customer' | 'order' | 'suggestion'

interface LogActionParams {
  actor: string // 'user:<uuid>' or 'system'
  actionType: ActionType
  entityType: EntityType
  entityId: string
  payload?: Record<string, any>
}

/**
 * Log an action to the audit trail
 */
export function logAction(params: LogActionParams): string {
  const { actor, actionType, entityType, entityId, payload } = params

  const id = randomUUID()
  const payloadHash = payload ? hashPayload(payload) : null

  db.prepare(`
    INSERT INTO actions_log (id, actor, action_type, entity_type, entity_id, payload_hash, created_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(id, actor, actionType, entityType, entityId, payloadHash)

  return id
}

/**
 * Get recent actions for an entity
 */
export function getEntityActions(entityType: EntityType, entityId: string, limit: number = 50) {
  return db.prepare(`
    SELECT * FROM actions_log
    WHERE entity_type = ? AND entity_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(entityType, entityId, limit)
}

/**
 * Get recent actions by actor
 */
export function getActorActions(actor: string, limit: number = 50) {
  return db.prepare(`
    SELECT * FROM actions_log
    WHERE actor = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(actor, limit)
}

/**
 * Get all recent actions
 */
export function getRecentActions(limit: number = 100) {
  return db.prepare(`
    SELECT * FROM actions_log
    ORDER BY created_at DESC
    LIMIT ?
  `).all(limit)
}

/**
 * Check if an action with same payload was already logged recently (deduplication)
 */
export function isDuplicateAction(
  actor: string,
  actionType: ActionType,
  entityType: EntityType,
  entityId: string,
  payload: Record<string, any>,
  withinMinutes: number = 5
): boolean {
  const payloadHash = hashPayload(payload)

  const existing = db.prepare(`
    SELECT id FROM actions_log
    WHERE actor = ?
      AND action_type = ?
      AND entity_type = ?
      AND entity_id = ?
      AND payload_hash = ?
      AND created_at > datetime('now', ?)
    LIMIT 1
  `).get(actor, actionType, entityType, entityId, payloadHash, `-${withinMinutes} minutes`)

  return !!existing
}

function hashPayload(payload: Record<string, any>): string {
  const json = JSON.stringify(payload, Object.keys(payload).sort())
  return createHash('sha256').update(json).digest('hex').substring(0, 16)
}
