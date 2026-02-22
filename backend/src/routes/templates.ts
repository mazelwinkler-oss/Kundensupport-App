import { Router } from 'express'
import { db } from '../db/database.js'
import { randomUUID } from 'crypto'
import { logAction } from '../utils/actions-log.js'

export const templatesRouter = Router()

// Helper to get current actor (placeholder until auth is implemented)
function getActor(req: any): string {
  return req.user?.id ? `user:${req.user.id}` : 'system'
}

// Get all templates
templatesRouter.get('/', (req, res) => {
  try {
    const { category } = req.query

    let query = 'SELECT * FROM templates'
    const params: any[] = []

    if (category) {
      query += ' WHERE category = ?'
      params.push(category)
    }

    query += ' ORDER BY category, name'

    const templates = db.prepare(query).all(...params)

    res.json(templates.map(formatTemplate))
  } catch (error) {
    console.error('Get templates error:', error)
    res.status(500).json({ error: 'Failed to fetch templates' })
  }
})

// Get single template
templatesRouter.get('/:id', (req, res) => {
  try {
    const template = db.prepare('SELECT * FROM templates WHERE id = ?').get(req.params.id)

    if (!template) {
      return res.status(404).json({ error: 'Template not found' })
    }

    res.json(formatTemplate(template))
  } catch (error) {
    console.error('Get template error:', error)
    res.status(500).json({ error: 'Failed to fetch template' })
  }
})

// Create template
templatesRouter.post('/', (req, res) => {
  try {
    const { name, category, subject, content, placeholders, taskTypes, keywords } = req.body

    const id = randomUUID()
    const now = new Date().toISOString()

    db.prepare(`
      INSERT INTO templates (id, name, category, subject, content, placeholders, task_types, keywords, usage_count, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `).run(
      id,
      name,
      category,
      subject,
      content,
      JSON.stringify(placeholders || []),
      JSON.stringify(taskTypes || []),
      JSON.stringify(keywords || []),
      now,
      now
    )

    // Log the action
    logAction({
      actor: getActor(req),
      actionType: 'template_created',
      entityType: 'template',
      entityId: id,
      payload: { name, category }
    })

    const template = db.prepare('SELECT * FROM templates WHERE id = ?').get(id)
    res.status(201).json(formatTemplate(template))
  } catch (error) {
    console.error('Create template error:', error)
    res.status(500).json({ error: 'Failed to create template' })
  }
})

// Update template
templatesRouter.patch('/:id', (req, res) => {
  try {
    const { name, category, subject, content, placeholders, taskTypes, keywords } = req.body
    const now = new Date().toISOString()

    const updates: string[] = ['updated_at = ?']
    const params: any[] = [now]

    if (name !== undefined) {
      updates.push('name = ?')
      params.push(name)
    }

    if (category !== undefined) {
      updates.push('category = ?')
      params.push(category)
    }

    if (subject !== undefined) {
      updates.push('subject = ?')
      params.push(subject)
    }

    if (content !== undefined) {
      updates.push('content = ?')
      params.push(content)
    }

    if (placeholders !== undefined) {
      updates.push('placeholders = ?')
      params.push(JSON.stringify(placeholders))
    }

    if (taskTypes !== undefined) {
      updates.push('task_types = ?')
      params.push(JSON.stringify(taskTypes))
    }

    if (keywords !== undefined) {
      updates.push('keywords = ?')
      params.push(JSON.stringify(keywords))
    }

    params.push(req.params.id)

    const result = db.prepare(`
      UPDATE templates
      SET ${updates.join(', ')}
      WHERE id = ?
    `).run(...params)

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Template not found' })
    }

    // Log the action
    logAction({
      actor: getActor(req),
      actionType: 'template_updated',
      entityType: 'template',
      entityId: req.params.id,
      payload: { updatedFields: Object.keys(req.body) }
    })

    const template = db.prepare('SELECT * FROM templates WHERE id = ?').get(req.params.id)
    res.json(formatTemplate(template))
  } catch (error) {
    console.error('Update template error:', error)
    res.status(500).json({ error: 'Failed to update template' })
  }
})

// Delete template
templatesRouter.delete('/:id', (req, res) => {
  try {
    // Get template before deleting for logging
    const template = db.prepare('SELECT name, category FROM templates WHERE id = ?').get(req.params.id) as any

    const result = db.prepare('DELETE FROM templates WHERE id = ?').run(req.params.id)

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Template not found' })
    }

    // Log the action
    logAction({
      actor: getActor(req),
      actionType: 'template_deleted',
      entityType: 'template',
      entityId: req.params.id,
      payload: { name: template?.name, category: template?.category }
    })

    res.status(204).send()
  } catch (error) {
    console.error('Delete template error:', error)
    res.status(500).json({ error: 'Failed to delete template' })
  }
})

// Apply template with variables
templatesRouter.post('/:id/apply', (req, res) => {
  try {
    const template = db.prepare('SELECT * FROM templates WHERE id = ?').get(req.params.id) as any

    if (!template) {
      return res.status(404).json({ error: 'Template not found' })
    }

    const { variables, taskId } = req.body
    let content = template.content
    let subject = template.subject || ''

    // Replace placeholders
    if (variables) {
      for (const [key, value] of Object.entries(variables)) {
        const placeholder = `{${key}}`
        content = content.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value as string)
        subject = subject.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value as string)
      }
    }

    // Increment usage_count
    db.prepare('UPDATE templates SET usage_count = COALESCE(usage_count, 0) + 1 WHERE id = ?')
      .run(req.params.id)

    // Track usage pattern for automation suggestions
    trackTemplateUsage(template.category)

    // Log the action
    logAction({
      actor: getActor(req),
      actionType: 'template_applied',
      entityType: 'template',
      entityId: template.id,
      payload: { taskId, category: template.category, variableKeys: Object.keys(variables || {}) }
    })

    res.json({
      content,
      subject,
      templateId: template.id,
      templateName: template.name,
      usageCount: (template.usage_count || 0) + 1
    })
  } catch (error) {
    console.error('Apply template error:', error)
    res.status(500).json({ error: 'Failed to apply template' })
  }
})

// Get template categories
templatesRouter.get('/meta/categories', (req, res) => {
  try {
    const categories = db.prepare(`
      SELECT DISTINCT category, COUNT(*) as count
      FROM templates
      GROUP BY category
      ORDER BY category
    `).all()

    res.json(categories)
  } catch (error) {
    console.error('Get categories error:', error)
    res.status(500).json({ error: 'Failed to fetch categories' })
  }
})

function formatTemplate(template: any) {
  return {
    id: template.id,
    name: template.name,
    category: template.category,
    subject: template.subject,
    content: template.content,
    placeholders: template.placeholders ? JSON.parse(template.placeholders) : [],
    taskTypes: template.task_types ? JSON.parse(template.task_types) : [],
    keywords: template.keywords ? JSON.parse(template.keywords) : [],
    usageCount: template.usage_count || 0,
    createdAt: template.created_at,
    updatedAt: template.updated_at
  }
}

function trackTemplateUsage(category: string) {
  const patternType = categoryToPatternType(category)
  if (!patternType) return

  const existing = db.prepare(
    'SELECT * FROM activity_patterns WHERE pattern_type = ?'
  ).get(patternType) as any

  if (existing) {
    db.prepare(`
      UPDATE activity_patterns
      SET frequency = frequency + 1, last_occurrence = ?
      WHERE pattern_type = ?
    `).run(new Date().toISOString(), patternType)
  } else {
    db.prepare(`
      INSERT INTO activity_patterns (id, pattern_type, frequency, last_occurrence)
      VALUES (?, ?, 1, ?)
    `).run(randomUUID(), patternType, new Date().toISOString())
  }
}

function categoryToPatternType(category: string): string | null {
  const mapping: Record<string, string> = {
    'Versand': 'shipping_confirmation',
    'Reklamation': 'ticket_response',
    'Finanzen': 'payment_reminder'
  }
  return mapping[category] || null
}
