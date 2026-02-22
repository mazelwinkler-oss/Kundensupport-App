import { Router } from 'express'
import { db } from '../db/database.js'
import { randomUUID } from 'crypto'

export const customersRouter = Router()

// Get all customers
customersRouter.get('/', (req, res) => {
  try {
    const { search, limit = 50, offset = 0 } = req.query

    let query = 'SELECT * FROM customers WHERE 1=1'
    const params: any[] = []

    if (search) {
      query += ' AND (name LIKE ? OR email LIKE ? OR company LIKE ?)'
      params.push(`%${search}%`, `%${search}%`, `%${search}%`)
    }

    query += ' ORDER BY updated_at DESC LIMIT ? OFFSET ?'
    params.push(Number(limit), Number(offset))

    const customers = db.prepare(query).all(...params)

    res.json(customers.map(formatCustomer))
  } catch (error) {
    console.error('Get customers error:', error)
    res.status(500).json({ error: 'Failed to fetch customers' })
  }
})

// Get single customer with tasks and orders
customersRouter.get('/:id', (req, res) => {
  try {
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id)

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' })
    }

    // Get customer's tasks
    const tasks = db.prepare(`
      SELECT * FROM tasks
      WHERE customer_id = ?
      ORDER BY
        CASE priority
          WHEN 'urgent' THEN 1
          WHEN 'high' THEN 2
          WHEN 'normal' THEN 3
          WHEN 'low' THEN 4
        END,
        created_at DESC
    `).all(req.params.id)

    res.json({
      ...formatCustomer(customer),
      tasks: tasks.map(formatTask),
      orders: [], // Will be populated from Weclapp
      interactions: [] // Will be populated from combined sources
    })
  } catch (error) {
    console.error('Get customer error:', error)
    res.status(500).json({ error: 'Failed to fetch customer' })
  }
})

// Create customer
customersRouter.post('/', (req, res) => {
  try {
    const { name, email, phone, company, hubspotId, weclappId } = req.body

    const id = randomUUID()
    const now = new Date().toISOString()

    db.prepare(`
      INSERT INTO customers (id, name, email, phone, company, hubspot_id, weclapp_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, email, phone, company, hubspotId, weclappId, now, now)

    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(id)
    res.status(201).json(formatCustomer(customer))
  } catch (error) {
    console.error('Create customer error:', error)
    res.status(500).json({ error: 'Failed to create customer' })
  }
})

// Update customer
customersRouter.patch('/:id', (req, res) => {
  try {
    const { name, email, phone, company, hubspotId, weclappId } = req.body
    const now = new Date().toISOString()

    const updates: string[] = ['updated_at = ?']
    const params: any[] = [now]

    if (name !== undefined) {
      updates.push('name = ?')
      params.push(name)
    }

    if (email !== undefined) {
      updates.push('email = ?')
      params.push(email)
    }

    if (phone !== undefined) {
      updates.push('phone = ?')
      params.push(phone)
    }

    if (company !== undefined) {
      updates.push('company = ?')
      params.push(company)
    }

    if (hubspotId !== undefined) {
      updates.push('hubspot_id = ?')
      params.push(hubspotId)
    }

    if (weclappId !== undefined) {
      updates.push('weclapp_id = ?')
      params.push(weclappId)
    }

    params.push(req.params.id)

    const result = db.prepare(`
      UPDATE customers
      SET ${updates.join(', ')}
      WHERE id = ?
    `).run(...params)

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Customer not found' })
    }

    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id)
    res.json(formatCustomer(customer))
  } catch (error) {
    console.error('Update customer error:', error)
    res.status(500).json({ error: 'Failed to update customer' })
  }
})

// Find customer by external ID
customersRouter.get('/external/:source/:externalId', (req, res) => {
  try {
    const { source, externalId } = req.params
    let query: string

    if (source === 'hubspot') {
      query = 'SELECT * FROM customers WHERE hubspot_id = ?'
    } else if (source === 'weclapp') {
      query = 'SELECT * FROM customers WHERE weclapp_id = ?'
    } else {
      return res.status(400).json({ error: 'Invalid source' })
    }

    const customer = db.prepare(query).get(externalId)

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' })
    }

    res.json(formatCustomer(customer))
  } catch (error) {
    console.error('Find customer error:', error)
    res.status(500).json({ error: 'Failed to find customer' })
  }
})

function formatCustomer(customer: any) {
  return {
    id: customer.id,
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    company: customer.company,
    hubspotId: customer.hubspot_id,
    weclappId: customer.weclapp_id,
    createdAt: customer.created_at,
    updatedAt: customer.updated_at
  }
}

function formatTask(task: any) {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    source: task.source,
    type: task.type,
    priority: task.priority,
    status: task.status,
    dueDate: task.due_date,
    createdAt: task.created_at,
    updatedAt: task.updated_at
  }
}
