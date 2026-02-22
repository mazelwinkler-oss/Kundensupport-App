import axios, { AxiosInstance } from 'axios'
import { db } from '../../db/database.js'
import { randomUUID } from 'crypto'

const HUBSPOT_API_URL = 'https://api.hubapi.com'

export class HubSpotClient {
  private client: AxiosInstance
  private accessToken: string

  constructor() {
    this.accessToken = process.env.HUBSPOT_ACCESS_TOKEN || ''

    this.client = axios.create({
      baseURL: HUBSPOT_API_URL,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      }
    })
  }

  async testConnection(): Promise<boolean> {
    if (!this.accessToken) {
      console.log('HubSpot: No access token configured')
      return false
    }

    try {
      await this.client.get('/crm/v3/objects/contacts?limit=1')
      return true
    } catch (error) {
      console.error('HubSpot connection test failed:', error)
      return false
    }
  }

  async getContacts(limit: number = 10, after?: string) {
    const params: any = {
      limit,
      properties: ['firstname', 'lastname', 'email', 'phone', 'company']
    }

    if (after) {
      params.after = after
    }

    const response = await this.client.get('/crm/v3/objects/contacts', { params })
    return response.data
  }

  async getContact(id: string) {
    const response = await this.client.get(`/crm/v3/objects/contacts/${id}`, {
      params: {
        properties: ['firstname', 'lastname', 'email', 'phone', 'company', 'createdate', 'lastmodifieddate']
      }
    })
    return response.data
  }

  async getDeals(limit: number = 10, after?: string) {
    const params: any = {
      limit,
      properties: ['dealname', 'amount', 'dealstage', 'closedate', 'pipeline']
    }

    if (after) {
      params.after = after
    }

    const response = await this.client.get('/crm/v3/objects/deals', { params })
    return response.data
  }

  async getTickets(limit: number = 10, after?: string, status?: string) {
    const params: any = {
      limit,
      properties: ['subject', 'content', 'hs_ticket_priority', 'hs_pipeline_stage', 'createdate']
    }

    if (after) {
      params.after = after
    }

    const response = await this.client.get('/crm/v3/objects/tickets', { params })

    // Filter by status if provided
    if (status && response.data.results) {
      response.data.results = response.data.results.filter(
        (ticket: any) => ticket.properties.hs_pipeline_stage === status
      )
    }

    return response.data
  }

  async getTicket(id: string) {
    const response = await this.client.get(`/crm/v3/objects/tickets/${id}`, {
      params: {
        properties: ['subject', 'content', 'hs_ticket_priority', 'hs_pipeline_stage', 'createdate', 'hs_lastmodifieddate'],
        associations: ['contacts']
      }
    })
    return response.data
  }

  async createTicket(data: {
    subject: string
    content?: string
    priority?: string
    contactId?: string
  }) {
    const properties: any = {
      subject: data.subject,
      content: data.content || '',
      hs_ticket_priority: data.priority || 'MEDIUM'
    }

    const response = await this.client.post('/crm/v3/objects/tickets', {
      properties
    })

    // Associate with contact if provided
    if (data.contactId) {
      await this.client.put(
        `/crm/v3/objects/tickets/${response.data.id}/associations/contacts/${data.contactId}/ticket_to_contact`
      )
    }

    return response.data
  }

  async updateTicket(id: string, data: any) {
    const response = await this.client.patch(`/crm/v3/objects/tickets/${id}`, {
      properties: data
    })
    return response.data
  }

  async getCalls(limit: number = 10, after?: string) {
    const params: any = {
      limit,
      properties: ['hs_call_title', 'hs_call_body', 'hs_call_direction', 'hs_call_status', 'hs_timestamp']
    }

    if (after) {
      params.after = after
    }

    try {
      const response = await this.client.get('/crm/v3/objects/calls', { params })
      return response.data
    } catch (error) {
      // Calls object might not be available
      console.error('Failed to fetch calls:', error)
      return { results: [] }
    }
  }

  async syncAll(types: string[]): Promise<Record<string, number>> {
    const results: Record<string, number> = {}

    for (const type of types) {
      try {
        let count = 0

        switch (type) {
          case 'contacts':
            count = await this.syncContacts()
            break
          case 'deals':
            count = await this.syncDeals()
            break
          case 'tickets':
            count = await this.syncTickets()
            break
        }

        results[type] = count
      } catch (error) {
        console.error(`Failed to sync ${type}:`, error)
        results[type] = 0
      }
    }

    return results
  }

  private async syncContacts(): Promise<number> {
    let count = 0
    let after: string | undefined

    do {
      const response = await this.getContacts(100, after)

      for (const contact of response.results) {
        await this.upsertCustomer(contact)
        count++
      }

      after = response.paging?.next?.after
    } while (after)

    return count
  }

  private async syncDeals(): Promise<number> {
    let count = 0
    let after: string | undefined

    do {
      const response = await this.getDeals(100, after)

      for (const deal of response.results) {
        await this.upsertTask({
          externalId: deal.id,
          title: deal.properties.dealname,
          source: 'hubspot',
          type: 'lead',
          priority: this.mapDealPriority(deal.properties.dealstage),
          status: this.mapDealStatus(deal.properties.dealstage),
          metadata: { amount: deal.properties.amount, pipeline: deal.properties.pipeline }
        })
        count++
      }

      after = response.paging?.next?.after
    } while (after)

    return count
  }

  private async syncTickets(): Promise<number> {
    let count = 0
    let after: string | undefined

    do {
      const response = await this.getTickets(100, after)

      for (const ticket of response.results) {
        await this.upsertTask({
          externalId: ticket.id,
          title: ticket.properties.subject,
          description: ticket.properties.content,
          source: 'hubspot',
          type: 'ticket',
          priority: this.mapTicketPriority(ticket.properties.hs_ticket_priority),
          status: this.mapTicketStatus(ticket.properties.hs_pipeline_stage)
        })
        count++
      }

      after = response.paging?.next?.after
    } while (after)

    return count
  }

  private async upsertCustomer(contact: any): Promise<string> {
    const props = contact.properties
    const name = [props.firstname, props.lastname].filter(Boolean).join(' ') || 'Unknown'

    const existing = db.prepare(
      'SELECT id FROM customers WHERE hubspot_id = ?'
    ).get(contact.id) as { id: string } | undefined

    if (existing) {
      db.prepare(`
        UPDATE customers
        SET name = ?, email = ?, phone = ?, company = ?, updated_at = ?
        WHERE hubspot_id = ?
      `).run(name, props.email, props.phone, props.company, new Date().toISOString(), contact.id)
      return existing.id
    } else {
      const id = randomUUID()
      db.prepare(`
        INSERT INTO customers (id, name, email, phone, company, hubspot_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, name, props.email, props.phone, props.company, contact.id, new Date().toISOString(), new Date().toISOString())
      return id
    }
  }

  private async upsertTask(task: {
    externalId: string
    title: string
    description?: string
    source: string
    type: string
    priority: string
    status: string
    customerId?: string
    metadata?: any
  }) {
    const existing = db.prepare(
      'SELECT id FROM tasks WHERE external_id = ? AND source = ?'
    ).get(task.externalId, task.source) as { id: string } | undefined

    if (existing) {
      db.prepare(`
        UPDATE tasks
        SET title = ?, description = ?, priority = ?, status = ?, metadata = ?, updated_at = ?
        WHERE id = ?
      `).run(
        task.title,
        task.description,
        task.priority,
        task.status,
        task.metadata ? JSON.stringify(task.metadata) : null,
        new Date().toISOString(),
        existing.id
      )
    } else {
      db.prepare(`
        INSERT INTO tasks (id, title, description, source, type, priority, status, customer_id, external_id, metadata, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        randomUUID(),
        task.title,
        task.description,
        task.source,
        task.type,
        task.priority,
        task.status,
        task.customerId,
        task.externalId,
        task.metadata ? JSON.stringify(task.metadata) : null,
        new Date().toISOString(),
        new Date().toISOString()
      )
    }
  }

  private mapTicketPriority(priority: string): string {
    const mapping: Record<string, string> = {
      'HIGH': 'urgent',
      'MEDIUM': 'normal',
      'LOW': 'low'
    }
    return mapping[priority] || 'normal'
  }

  private mapTicketStatus(stage: string): string {
    // Common HubSpot ticket stages
    if (stage?.includes('CLOSED') || stage?.includes('RESOLVED')) return 'completed'
    if (stage?.includes('WAITING') || stage?.includes('PENDING')) return 'waiting'
    if (stage?.includes('PROGRESS') || stage?.includes('WORKING')) return 'in_progress'
    return 'open'
  }

  private mapDealPriority(stage: string): string {
    // Deals closer to closing are higher priority
    if (stage?.includes('CLOSED') || stage?.includes('WON')) return 'normal'
    if (stage?.includes('CONTRACT') || stage?.includes('DECISION')) return 'high'
    if (stage?.includes('QUALIFIED')) return 'normal'
    return 'low'
  }

  private mapDealStatus(stage: string): string {
    if (stage?.includes('CLOSED') || stage?.includes('WON') || stage?.includes('LOST')) return 'completed'
    return 'open'
  }
}
