import { Router } from 'express'
import { db } from '../db/database.js'

export const dailyPlanRouter = Router()

// Time estimates per task type (in minutes)
const TIME_ESTIMATES: Record<string, number> = {
  ticket: 15,
  call: 10,
  order: 5,
  lead: 20,
  payment: 10,
}

// Priority order for sorting
const PRIORITY_ORDER: Record<string, number> = {
  urgent: 1,
  high: 2,
  normal: 3,
  low: 4,
}

// GET /api/daily-plan - Returns a prioritized daily plan
dailyPlanRouter.get('/', (req, res) => {
  try {
    const tasks = db.prepare(`
      SELECT
        t.*,
        c.name as customer_name,
        c.email as customer_email,
        c.phone as customer_phone
      FROM tasks t
      LEFT JOIN customers c ON t.customer_id = c.id
      WHERE t.status NOT IN ('completed')
      ORDER BY
        CASE t.priority
          WHEN 'urgent' THEN 1
          WHEN 'high' THEN 2
          WHEN 'normal' THEN 3
          WHEN 'low' THEN 4
        END,
        CASE WHEN t.due_date IS NOT NULL AND t.due_date < datetime('now') THEN 0 ELSE 1 END,
        t.due_date ASC,
        t.created_at ASC
      LIMIT 30
    `).all() as any[]

    // Build plan entries with time estimates
    let currentTime = new Date()
    // Start from beginning of current hour or now if after 8am
    const startHour = Math.max(currentTime.getHours(), 8)
    currentTime.setHours(startHour, 0, 0, 0)
    if (new Date() > currentTime) {
      currentTime = new Date()
    }

    let totalMinutes = 0
    const planItems = tasks.map((task, index) => {
      const estimatedMinutes = TIME_ESTIMATES[task.type] || 10
      const startTime = new Date(currentTime.getTime() + totalMinutes * 60 * 1000)
      const endTime = new Date(startTime.getTime() + estimatedMinutes * 60 * 1000)
      const isOverdue = task.due_date && new Date(task.due_date) < new Date()

      totalMinutes += estimatedMinutes

      return {
        position: index + 1,
        task: {
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
          dueDate: task.due_date,
          createdAt: task.created_at,
          updatedAt: task.updated_at,
          metadata: task.metadata ? JSON.parse(task.metadata) : undefined,
        },
        estimatedMinutes,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        isOverdue,
      }
    })

    const finishTime = new Date(currentTime.getTime() + totalMinutes * 60 * 1000)

    // Summary stats
    const urgentCount = tasks.filter(t => t.priority === 'urgent').length
    const overdueCount = tasks.filter(t => t.due_date && new Date(t.due_date) < new Date()).length

    res.json({
      generatedAt: new Date().toISOString(),
      totalTasks: tasks.length,
      totalMinutes,
      estimatedFinishTime: finishTime.toISOString(),
      urgentCount,
      overdueCount,
      items: planItems,
    })
  } catch (error) {
    console.error('Daily plan error:', error)
    res.status(500).json({ error: 'Failed to generate daily plan' })
  }
})

// PATCH /api/daily-plan/task/:id/done - Mark a task as completed from the plan
dailyPlanRouter.patch('/task/:id/done', (req, res) => {
  try {
    const now = new Date().toISOString()
    const result = db.prepare(`
      UPDATE tasks SET status = 'completed', updated_at = ? WHERE id = ?
    `).run(now, req.params.id)

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Task not found' })
    }
    res.json({ success: true })
  } catch (error) {
    console.error('Mark done error:', error)
    res.status(500).json({ error: 'Failed to mark task as done' })
  }
})
