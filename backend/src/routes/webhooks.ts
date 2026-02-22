import { Router } from 'express'
import { db } from '../db/database.js'
import { randomUUID } from 'crypto'

export const webhooksRouter = Router()

// Webhook for n8n - create task
webhooksRouter.post('/task', (req, res) => {
  try {
    const {
      title,
      description,
      source,
      type,
      priority = 'normal',
      customerEmail,
      customerName,
      externalId,
      metadata
    } = req.body

    if (!title || !source || !type) {
      return res.status(400).json({
        error: 'Missing required fields: title, source, type'
      })
    }

    // Find or create customer if email provided
    let customerId: string | undefined
    if (customerEmail) {
      const existing = db.prepare(
        'SELECT id FROM customers WHERE email = ?'
      ).get(customerEmail) as { id: string } | undefined

      if (existing) {
        customerId = existing.id
      } else if (customerName) {
        customerId = randomUUID()
        db.prepare(`
          INSERT INTO customers (id, name, email, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?)
        `).run(customerId, customerName, customerEmail, new Date().toISOString(), new Date().toISOString())
      }
    }

    const taskId = randomUUID()
    const now = new Date().toISOString()

    db.prepare(`
      INSERT INTO tasks (id, title, description, source, type, priority, status, customer_id, external_id, metadata, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?)
    `).run(
      taskId,
      title,
      description,
      source,
      type,
      priority,
      customerId,
      externalId,
      metadata ? JSON.stringify(metadata) : null,
      now,
      now
    )

    res.status(201).json({
      success: true,
      taskId,
      message: 'Task created successfully'
    })
  } catch (error) {
    console.error('Webhook task creation error:', error)
    res.status(500).json({ error: 'Failed to create task' })
  }
})

// Webhook for n8n - update task status
webhooksRouter.patch('/task/:id/status', (req, res) => {
  try {
    const { status } = req.body
    const validStatuses = ['open', 'in_progress', 'waiting', 'completed']

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      })
    }

    const result = db.prepare(`
      UPDATE tasks
      SET status = ?, updated_at = ?
      WHERE id = ?
    `).run(status, new Date().toISOString(), req.params.id)

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Task not found' })
    }

    res.json({
      success: true,
      taskId: req.params.id,
      status
    })
  } catch (error) {
    console.error('Webhook task update error:', error)
    res.status(500).json({ error: 'Failed to update task' })
  }
})

// Webhook for HubSpot events
webhooksRouter.post('/hubspot', (req, res) => {
  try {
    const events = Array.isArray(req.body) ? req.body : [req.body]

    for (const event of events) {
      handleHubSpotEvent(event)
    }

    res.json({ success: true, processed: events.length })
  } catch (error) {
    console.error('HubSpot webhook error:', error)
    res.status(500).json({ error: 'Failed to process HubSpot webhook' })
  }
})

// Webhook for Weclapp events
webhooksRouter.post('/weclapp', (req, res) => {
  try {
    const event = req.body
    handleWeclappEvent(event)

    res.json({ success: true })
  } catch (error) {
    console.error('Weclapp webhook error:', error)
    res.status(500).json({ error: 'Failed to process Weclapp webhook' })
  }
})

// Track pattern for automation suggestions
webhooksRouter.post('/pattern', (req, res) => {
  try {
    const { patternType, metadata } = req.body

    if (!patternType) {
      return res.status(400).json({ error: 'patternType is required' })
    }

    const existing = db.prepare(
      'SELECT id, frequency FROM activity_patterns WHERE pattern_type = ?'
    ).get(patternType) as { id: string; frequency: number } | undefined

    if (existing) {
      db.prepare(`
        UPDATE activity_patterns
        SET frequency = frequency + 1, last_occurrence = ?, metadata = ?
        WHERE id = ?
      `).run(new Date().toISOString(), metadata ? JSON.stringify(metadata) : null, existing.id)
    } else {
      db.prepare(`
        INSERT INTO activity_patterns (id, pattern_type, frequency, last_occurrence, metadata, created_at)
        VALUES (?, ?, 1, ?, ?, ?)
      `).run(randomUUID(), patternType, new Date().toISOString(), metadata ? JSON.stringify(metadata) : null, new Date().toISOString())
    }

    res.json({ success: true })
  } catch (error) {
    console.error('Pattern tracking error:', error)
    res.status(500).json({ error: 'Failed to track pattern' })
  }
})

function handleHubSpotEvent(event: any) {
  const { subscriptionType, objectId, propertyName, propertyValue } = event

  switch (subscriptionType) {
    case 'ticket.creation':
      // New ticket created - sync it
      console.log('New HubSpot ticket:', objectId)
      break

    case 'ticket.propertyChange':
      // Ticket updated
      if (propertyName === 'hs_pipeline_stage') {
        const task = db.prepare(
          'SELECT id FROM tasks WHERE external_id = ? AND source = ?'
        ).get(objectId, 'hubspot') as { id: string } | undefined

        if (task) {
          const status = mapHubSpotStageToStatus(propertyValue)
          db.prepare(`
            UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?
          `).run(status, new Date().toISOString(), task.id)
        }
      }
      break

    case 'deal.creation':
      console.log('New HubSpot deal:', objectId)
      break

    case 'contact.creation':
      console.log('New HubSpot contact:', objectId)
      break
  }
}

function handleWeclappEvent(event: any) {
  const { entityType, entityId, eventType } = event

  switch (entityType) {
    case 'salesOrder':
      if (eventType === 'CREATE' || eventType === 'UPDATE') {
        console.log('Weclapp sales order event:', entityId, eventType)
        // Trigger sync for this order
      }
      break

    case 'shipment':
      if (eventType === 'CREATE') {
        console.log('New Weclapp shipment:', entityId)
        // Track shipping pattern
        trackPattern('shipping_confirmation')
      }
      break

    case 'salesInvoice':
      if (eventType === 'CREATE') {
        console.log('New Weclapp invoice:', entityId)
      }
      break
  }
}

function mapHubSpotStageToStatus(stage: string): string {
  if (stage?.includes('CLOSED') || stage?.includes('RESOLVED')) return 'completed'
  if (stage?.includes('WAITING') || stage?.includes('PENDING')) return 'waiting'
  if (stage?.includes('PROGRESS') || stage?.includes('WORKING')) return 'in_progress'
  return 'open'
}

function trackPattern(patternType: string) {
  const existing = db.prepare(
    'SELECT id FROM activity_patterns WHERE pattern_type = ?'
  ).get(patternType) as { id: string } | undefined

  if (existing) {
    db.prepare(`
      UPDATE activity_patterns
      SET frequency = frequency + 1, last_occurrence = ?
      WHERE id = ?
    `).run(new Date().toISOString(), existing.id)
  } else {
    db.prepare(`
      INSERT INTO activity_patterns (id, pattern_type, frequency, last_occurrence, created_at)
      VALUES (?, ?, 1, ?, ?)
    `).run(randomUUID(), patternType, new Date().toISOString(), new Date().toISOString())
  }
}
