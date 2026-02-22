import { Router } from 'express'
import { db } from '../db/database.js'

export const dashboardRouter = Router()

dashboardRouter.get('/stats', (req, res) => {
  try {
    // Get task counts by type and status
    const taskStats = db.prepare(`
      SELECT
        type,
        COUNT(*) as count
      FROM tasks
      WHERE status != 'completed'
      GROUP BY type
    `).all() as { type: string; count: number }[]

    // Get urgent tasks
    const urgentTasks = db.prepare(`
      SELECT
        t.*,
        c.name as customer_name
      FROM tasks t
      LEFT JOIN customers c ON t.customer_id = c.id
      WHERE t.priority IN ('urgent', 'high')
        AND t.status != 'completed'
      ORDER BY
        CASE t.priority
          WHEN 'urgent' THEN 1
          WHEN 'high' THEN 2
        END,
        t.created_at ASC
      LIMIT 10
    `).all()

    // Calculate stats
    const newLeads = taskStats.find(s => s.type === 'lead')?.count || 0
    const openTickets = taskStats.find(s => s.type === 'ticket')?.count || 0
    const pendingOrders = taskStats.find(s => s.type === 'order')?.count || 0
    const missedCalls = taskStats.find(s => s.type === 'call')?.count || 0

    // Get automation suggestions based on patterns
    const patterns = db.prepare(`
      SELECT * FROM activity_patterns
      WHERE frequency >= 5
      ORDER BY frequency DESC
      LIMIT 5
    `).all()

    const automationSuggestions = patterns.map((p: any) => ({
      id: p.id,
      title: getPatternTitle(p.pattern_type),
      description: getPatternDescription(p.pattern_type, p.frequency),
      potentialTimeSaved: estimateTimeSaved(p.frequency),
      frequency: p.frequency,
      workflowType: p.pattern_type
    }))

    res.json({
      newLeads,
      openTickets,
      pendingOrders,
      missedCalls,
      urgentTasks: urgentTasks.map(formatTask),
      automationSuggestions
    })
  } catch (error) {
    console.error('Dashboard stats error:', error)
    res.status(500).json({ error: 'Failed to fetch dashboard stats' })
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
    dueDate: task.due_date,
    createdAt: task.created_at,
    updatedAt: task.updated_at,
    metadata: task.metadata ? JSON.parse(task.metadata) : undefined
  }
}

function getPatternTitle(patternType: string): string {
  const titles: Record<string, string> = {
    'shipping_confirmation': 'Versandbestaetigungen automatisieren',
    'payment_reminder': 'Zahlungserinnerungen automatisieren',
    'ticket_response': 'Ticket-Antworten automatisieren',
    'lead_followup': 'Lead-Nachverfolgung automatisieren'
  }
  return titles[patternType] || 'Automation verfuegbar'
}

function getPatternDescription(patternType: string, frequency: number): string {
  const descriptions: Record<string, string> = {
    'shipping_confirmation': `Sie haben diese Woche ${frequency}x Versandbestaetigungen geschrieben.`,
    'payment_reminder': `Sie haben diese Woche ${frequency}x Zahlungserinnerungen versendet.`,
    'ticket_response': `Sie haben diese Woche ${frequency}x aehnliche Ticket-Antworten geschrieben.`,
    'lead_followup': `Sie haben ${frequency} Leads, die auf Follow-up warten.`
  }
  return descriptions[patternType] || `Dieses Muster wurde ${frequency}x erkannt.`
}

function estimateTimeSaved(frequency: number): string {
  const minutesPerAction = 3
  const totalMinutes = frequency * minutesPerAction
  if (totalMinutes < 60) {
    return `${totalMinutes} Min/Woche`
  }
  const hours = Math.round(totalMinutes / 60 * 10) / 10
  return `${hours} Std/Woche`
}
