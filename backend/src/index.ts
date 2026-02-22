import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { initDatabase } from './db/database.js'
import { tasksRouter } from './routes/tasks.js'
import { customersRouter } from './routes/customers.js'
import { templatesRouter } from './routes/templates.js'
import { dashboardRouter } from './routes/dashboard.js'
import { hubspotRouter } from './routes/hubspot.js'
import { weclappRouter } from './routes/weclapp.js'
import { webhooksRouter } from './routes/webhooks.js'
import { aiSuggestionsRouter } from './routes/ai-suggestions.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors())
app.use(express.json())

// Initialize database
initDatabase()

// Routes
app.use('/api/dashboard', dashboardRouter)
app.use('/api/tasks', tasksRouter)
app.use('/api/customers', customersRouter)
app.use('/api/templates', templatesRouter)
app.use('/api/hubspot', hubspotRouter)
app.use('/api/weclapp', weclappRouter)
app.use('/api/webhooks', webhooksRouter)
app.use('/api/ai-suggestions', aiSuggestionsRouter)

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Error handling
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err)
  res.status(500).json({ error: 'Internal server error', message: err.message })
})

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
  console.log(`API endpoints available at http://localhost:${PORT}/api`)
})
