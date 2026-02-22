import { Router } from 'express'
import { HubSpotClient } from '../integrations/hubspot/client.js'

export const hubspotRouter = Router()

// Test connection
hubspotRouter.get('/test', async (req, res) => {
  try {
    const client = new HubSpotClient()
    const isConnected = await client.testConnection()

    if (isConnected) {
      res.json({ status: 'connected', message: 'HubSpot connection successful' })
    } else {
      res.status(503).json({ status: 'disconnected', message: 'HubSpot connection failed' })
    }
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to test HubSpot connection'
    })
  }
})

// Get contacts
hubspotRouter.get('/contacts', async (req, res) => {
  try {
    const client = new HubSpotClient()
    const { limit = 10, after } = req.query

    const contacts = await client.getContacts(Number(limit), after as string | undefined)
    res.json(contacts)
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch contacts' })
  }
})

// Get single contact
hubspotRouter.get('/contacts/:id', async (req, res) => {
  try {
    const client = new HubSpotClient()
    const contact = await client.getContact(req.params.id)
    res.json(contact)
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch contact' })
  }
})

// Get deals/leads
hubspotRouter.get('/deals', async (req, res) => {
  try {
    const client = new HubSpotClient()
    const { limit = 10, after } = req.query

    const deals = await client.getDeals(Number(limit), after as string | undefined)
    res.json(deals)
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch deals' })
  }
})

// Get tickets
hubspotRouter.get('/tickets', async (req, res) => {
  try {
    const client = new HubSpotClient()
    const { limit = 10, after, status } = req.query

    const tickets = await client.getTickets(Number(limit), after as string | undefined, status as string | undefined)
    res.json(tickets)
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch tickets' })
  }
})

// Get single ticket
hubspotRouter.get('/tickets/:id', async (req, res) => {
  try {
    const client = new HubSpotClient()
    const ticket = await client.getTicket(req.params.id)
    res.json(ticket)
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch ticket' })
  }
})

// Update ticket
hubspotRouter.patch('/tickets/:id', async (req, res) => {
  try {
    const client = new HubSpotClient()
    const ticket = await client.updateTicket(req.params.id, req.body)
    res.json(ticket)
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to update ticket' })
  }
})

// Create ticket
hubspotRouter.post('/tickets', async (req, res) => {
  try {
    const client = new HubSpotClient()
    const ticket = await client.createTicket(req.body)
    res.status(201).json(ticket)
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to create ticket' })
  }
})

// Get call engagements (from Aircall via HubSpot)
hubspotRouter.get('/calls', async (req, res) => {
  try {
    const client = new HubSpotClient()
    const { limit = 10, after } = req.query

    const calls = await client.getCalls(Number(limit), after as string | undefined)
    res.json(calls)
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch calls' })
  }
})

// Sync data from HubSpot
hubspotRouter.post('/sync', async (req, res) => {
  try {
    const client = new HubSpotClient()
    const { types = ['contacts', 'deals', 'tickets'] } = req.body

    const results = await client.syncAll(types)
    res.json({
      status: 'completed',
      results
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to sync HubSpot data' })
  }
})
