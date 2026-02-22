import { Router } from 'express'
import { db } from '../db/database.js'
import { randomUUID } from 'crypto'

export const tasksRouter = Router()

// Get all tasks with filters
tasksRouter.get('/', (req, res) => {
  try {
    const { source, priority, status, type, search, limit = 50, offset = 0 } = req.query

    let query = `
      SELECT
        t.*,
        c.name as customer_name
      FROM tasks t
      LEFT JOIN customers c ON t.customer_id = c.id
      WHERE 1=1
    `
    const params: any[] = []

    if (source) {
      query += ' AND t.source = ?'
      params.push(source)
    }

    if (priority) {
      query += ' AND t.priority = ?'
      params.push(priority)
    }

    if (status) {
      query += ' AND t.status = ?'
      params.push(status)
    }

    if (type) {
      query += ' AND t.type = ?'
      params.push(type)
    }

    if (search) {
      query += ' AND (t.title LIKE ? OR c.name LIKE ?)'
      params.push(`%${search}%`, `%${search}%`)
    }

    query += `
      ORDER BY
        CASE t.priority
          WHEN 'urgent' THEN 1
          WHEN 'high' THEN 2
          WHEN 'normal' THEN 3
          WHEN 'low' THEN 4
        END,
        t.created_at DESC
      LIMIT ? OFFSET ?
    `
    params.push(Number(limit), Number(offset))

    const tasks = db.prepare(query).all(...params)

    res.json(tasks.map(formatTask))
  } catch (error) {
    console.error('Get tasks error:', error)
    res.status(500).json({ error: 'Failed to fetch tasks' })
  }
})

// Get single task
tasksRouter.get('/:id', (req, res) => {
  try {
    const task = db.prepare(`
      SELECT
        t.*,
        c.name as customer_name,
        c.email as customer_email,
        c.phone as customer_phone,
        c.company as customer_company
      FROM tasks t
      LEFT JOIN customers c ON t.customer_id = c.id
      WHERE t.id = ?
    `).get(req.params.id)

    if (!task) {
      return res.status(404).json({ error: 'Task not found' })
    }

    res.json(formatTask(task))
  } catch (error) {
    console.error('Get task error:', error)
    res.status(500).json({ error: 'Failed to fetch task' })
  }
})

// Create task
tasksRouter.post('/', (req, res) => {
  try {
    const {
      title,
      description,
      source,
      type,
      priority = 'normal',
      status = 'open',
      customerId,
      externalId,
      dueDate,
      metadata
    } = req.body

    const id = randomUUID()
    const now = new Date().toISOString()

    db.prepare(`
      INSERT INTO tasks (id, title, description, source, type, priority, status, customer_id, external_id, due_date, metadata, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      title,
      description,
      source,
      type,
      priority,
      status,
      customerId,
      externalId,
      dueDate,
      metadata ? JSON.stringify(metadata) : null,
      now,
      now
    )

    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id)
    res.status(201).json(formatTask(task))
  } catch (error) {
    console.error('Create task error:', error)
    res.status(500).json({ error: 'Failed to create task' })
  }
})

// Update task
tasksRouter.patch('/:id', (req, res) => {
  try {
    const { title, description, priority, status, dueDate, metadata } = req.body
    const now = new Date().toISOString()

    const updates: string[] = ['updated_at = ?']
    const params: any[] = [now]

    if (title !== undefined) {
      updates.push('title = ?')
      params.push(title)
    }

    if (description !== undefined) {
      updates.push('description = ?')
      params.push(description)
    }

    if (priority !== undefined) {
      updates.push('priority = ?')
      params.push(priority)
    }

    if (status !== undefined) {
      updates.push('status = ?')
      params.push(status)
    }

    if (dueDate !== undefined) {
      updates.push('due_date = ?')
      params.push(dueDate)
    }

    if (metadata !== undefined) {
      updates.push('metadata = ?')
      params.push(JSON.stringify(metadata))
    }

    params.push(req.params.id)

    const result = db.prepare(`
      UPDATE tasks
      SET ${updates.join(', ')}
      WHERE id = ?
    `).run(...params)

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Task not found' })
    }

    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id)
    res.json(formatTask(task))
  } catch (error) {
    console.error('Update task error:', error)
    res.status(500).json({ error: 'Failed to update task' })
  }
})

// Delete task
tasksRouter.delete('/:id', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id)

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Task not found' })
    }

    res.status(204).send()
  } catch (error) {
    console.error('Delete task error:', error)
    res.status(500).json({ error: 'Failed to delete task' })
  }
})

function formatTask(task: any) {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    source: task.source,
    type: task.type,
    priority: task.priority,
    status: task.status,
    customerId: task.customer_id,
    customerName: task.customer_name,
    customerEmail: task.customer_email,
    customerPhone: task.customer_phone,
    customerCompany: task.customer_company,
    externalId: task.external_id,
    dueDate: task.due_date,
    createdAt: task.created_at,
    updatedAt: task.updated_at,
    metadata: task.metadata ? JSON.parse(task.metadata) : undefined
  }
}
