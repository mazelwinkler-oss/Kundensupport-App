/**
 * Background sync service: Weclapp -> SQLite
 * Runs on startup and every 15 minutes.
 * Also handles auto-escalation of overdue tasks every 5 minutes.
 */

import { WeclappClient } from '../integrations/weclapp/client.js'
import { db } from '../db/database.js'
import { randomUUID } from 'crypto'

let syncRunning = false

export async function runWeclappSync(): Promise<void> {
  if (syncRunning) {
    console.log('[Sync] Already running, skipping')
    return
  }
  syncRunning = true

  const client = new WeclappClient()
  const startedAt = new Date().toISOString()
  const logId = randomUUID()

  try {
    console.log('[Sync] Starting Weclapp sync...')

    // Test connection first
    const connected = await client.testConnection()
    if (!connected) {
      console.warn('[Sync] Weclapp not reachable, skipping sync')
      return
    }

    const results = await client.syncAll(['customers', 'orders'])

    db.prepare(`
      INSERT INTO sync_log (id, source, sync_type, status, records_synced, started_at, completed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      logId,
      'weclapp',
      'full',
      'success',
      (results.customers || 0) + (results.orders || 0),
      startedAt,
      new Date().toISOString()
    )

    console.log(`[Sync] Done: ${results.customers} customers, ${results.orders} orders`)
  } catch (error: any) {
    console.error('[Sync] Error:', error.message)
    db.prepare(`
      INSERT INTO sync_log (id, source, sync_type, status, records_synced, error_message, started_at, completed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(logId, 'weclapp', 'full', 'error', 0, error.message, startedAt, new Date().toISOString())
  } finally {
    syncRunning = false
  }
}

export function runAutoEscalation(): void {
  try {
    const now = new Date().toISOString()

    // Escalate tasks whose due date has passed and are not completed
    const escalated = db.prepare(`
      UPDATE tasks
      SET priority = 'urgent', updated_at = ?
      WHERE status NOT IN ('completed')
        AND due_date IS NOT NULL
        AND due_date < ?
        AND priority NOT IN ('urgent')
    `).run(now, now)

    if (escalated.changes > 0) {
      console.log(`[Escalation] Escalated ${escalated.changes} overdue tasks to urgent`)
    }

    // Mark weclapp orders older than 7 days as high priority if not already urgent
    const oldOrders = db.prepare(`
      UPDATE tasks
      SET priority = 'high', updated_at = ?
      WHERE source = 'weclapp'
        AND type = 'order'
        AND status NOT IN ('completed')
        AND priority = 'normal'
        AND created_at < datetime('now', '-7 days')
    `).run(now)

    if (oldOrders.changes > 0) {
      console.log(`[Escalation] Raised ${oldOrders.changes} old Weclapp orders to high priority`)
    }
  } catch (error: any) {
    console.error('[Escalation] Error:', error.message)
  }
}

export function startBackgroundJobs(): void {
  // Initial sync after 2 seconds (let server start first)
  setTimeout(() => {
    runWeclappSync()
    runAutoEscalation()
  }, 2000)

  // Re-sync every 15 minutes
  setInterval(() => {
    runWeclappSync()
  }, 15 * 60 * 1000)

  // Auto-escalation every 5 minutes
  setInterval(() => {
    runAutoEscalation()
  }, 5 * 60 * 1000)

  console.log('[Jobs] Background jobs scheduled (sync: 15min, escalation: 5min)')
}
