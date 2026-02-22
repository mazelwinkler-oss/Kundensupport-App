import axios, { AxiosInstance } from 'axios'
import { db } from '../../db/database.js'
import { randomUUID } from 'crypto'

export class WeclappClient {
  private client: AxiosInstance
  private apiToken: string
  private baseUrl: string

  constructor() {
    this.apiToken = process.env.WECLAPP_API_TOKEN || ''

    // Unterstütze sowohl BASE_URL als auch TENANT
    const tenant = process.env.WECLAPP_TENANT || ''
    this.baseUrl = process.env.WECLAPP_BASE_URL ||
      (tenant ? `https://${tenant}.weclapp.com/webapp/api/v1` : '')

    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'AuthenticationToken': this.apiToken,
        'Content-Type': 'application/json'
      }
    })
  }

  async testConnection(): Promise<boolean> {
    if (!this.apiToken || !this.baseUrl) {
      console.log('Weclapp: No API token or base URL configured')
      return false
    }

    try {
      await this.client.get('/customer?pageSize=1')
      return true
    } catch (error) {
      console.error('Weclapp connection test failed:', error)
      return false
    }
  }

  async getSalesOrders(page: number = 1, pageSize: number = 20, status?: string) {
    const params: any = {
      page,
      pageSize,
      sort: '-createdDate'
    }

    if (status) {
      params.salesOrderStatus = status
    }

    const response = await this.client.get('/salesOrder', { params })
    return {
      results: response.data.result || [],
      totalCount: response.headers['x-total-count'] || 0,
      page,
      pageSize
    }
  }

  async getSalesOrder(id: string) {
    const response = await this.client.get(`/salesOrder/id/${id}`)
    return response.data
  }

  async updateSalesOrder(id: string, data: any) {
    const response = await this.client.put(`/salesOrder/id/${id}`, data)
    return response.data
  }

  async getShipments(page: number = 1, pageSize: number = 20) {
    const response = await this.client.get('/shipment', {
      params: { page, pageSize, sort: '-createdDate' }
    })
    return {
      results: response.data.result || [],
      totalCount: response.headers['x-total-count'] || 0,
      page,
      pageSize
    }
  }

  async getInvoices(page: number = 1, pageSize: number = 20, unpaidOnly: boolean = false) {
    const params: any = {
      page,
      pageSize,
      sort: '-createdDate'
    }

    if (unpaidOnly) {
      params.paymentStatus = 'OPEN'
    }

    const response = await this.client.get('/salesInvoice', { params })
    return {
      results: response.data.result || [],
      totalCount: response.headers['x-total-count'] || 0,
      page,
      pageSize
    }
  }

  async getCustomers(page: number = 1, pageSize: number = 20, search?: string) {
    const params: any = {
      page,
      pageSize,
      sort: 'company'
    }

    if (search) {
      params.company = `~${search}`
    }

    const response = await this.client.get('/customer', { params })
    return {
      results: response.data.result || [],
      totalCount: response.headers['x-total-count'] || 0,
      page,
      pageSize
    }
  }

  async getCustomer(id: string) {
    const response = await this.client.get(`/customer/id/${id}`)
    return response.data
  }

  async getArticleStock(articleId: string) {
    const response = await this.client.get('/warehouseStock', {
      params: { articleId }
    })
    return response.data.result || []
  }

  async getAllStock() {
    const response = await this.client.get('/warehouseStock', {
      params: { pageSize: 1000 }
    })
    return response.data.result || []
  }

  async syncAll(types: string[]): Promise<Record<string, number>> {
    const results: Record<string, number> = {}

    for (const type of types) {
      try {
        let count = 0

        switch (type) {
          case 'customers':
            count = await this.syncCustomers()
            break
          case 'orders':
            count = await this.syncOrders()
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

  private async syncCustomers(): Promise<number> {
    let count = 0
    let page = 1
    let hasMore = true

    while (hasMore) {
      const response = await this.getCustomers(page, 100)

      for (const customer of response.results) {
        await this.upsertCustomer(customer)
        count++
      }

      hasMore = count < Number(response.totalCount)
      page++
    }

    return count
  }

  private async syncOrders(): Promise<number> {
    let count = 0
    let page = 1
    let hasMore = true

    while (hasMore) {
      const response = await this.getSalesOrders(page, 100)

      for (const order of response.results) {
        await this.upsertOrderTask(order)
        count++
      }

      hasMore = count < Number(response.totalCount)
      page++
    }

    return count
  }

  private async upsertCustomer(customer: any): Promise<string> {
    const existing = db.prepare(
      'SELECT id FROM customers WHERE weclapp_id = ?'
    ).get(customer.id) as { id: string } | undefined

    const name = customer.company ||
      [customer.firstName, customer.lastName].filter(Boolean).join(' ') ||
      'Unknown'

    const email = customer.email || customer.primaryAddress?.email
    const phone = customer.phone || customer.primaryAddress?.phone

    if (existing) {
      db.prepare(`
        UPDATE customers
        SET name = ?, email = ?, phone = ?, company = ?, updated_at = ?
        WHERE weclapp_id = ?
      `).run(name, email, phone, customer.company, new Date().toISOString(), customer.id)
      return existing.id
    } else {
      const id = randomUUID()
      db.prepare(`
        INSERT INTO customers (id, name, email, phone, company, weclapp_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, name, email, phone, customer.company, customer.id, new Date().toISOString(), new Date().toISOString())
      return id
    }
  }

  private async upsertOrderTask(order: any): Promise<void> {
    const existing = db.prepare(
      'SELECT id FROM tasks WHERE external_id = ? AND source = ?'
    ).get(order.id, 'weclapp') as { id: string } | undefined

    // Find or create customer
    let customerId: string | undefined
    if (order.customerId) {
      const customer = db.prepare(
        'SELECT id FROM customers WHERE weclapp_id = ?'
      ).get(order.customerId) as { id: string } | undefined
      customerId = customer?.id
    }

    const title = `Auftrag ${order.orderNumber || order.id}`
    const priority = this.mapOrderPriority(order)
    const status = this.mapOrderStatus(order.salesOrderStatus)

    const metadata = {
      orderNumber: order.orderNumber,
      totalAmount: order.netAmountInCompanyCurrency,
      currency: order.currency?.name || 'EUR',
      items: order.orderItems?.length || 0,
      shippingStatus: order.shippingStatus
    }

    if (existing) {
      db.prepare(`
        UPDATE tasks
        SET title = ?, priority = ?, status = ?, customer_id = ?, metadata = ?, updated_at = ?
        WHERE id = ?
      `).run(
        title,
        priority,
        status,
        customerId,
        JSON.stringify(metadata),
        new Date().toISOString(),
        existing.id
      )
    } else {
      db.prepare(`
        INSERT INTO tasks (id, title, source, type, priority, status, customer_id, external_id, metadata, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        randomUUID(),
        title,
        'weclapp',
        'order',
        priority,
        status,
        customerId,
        order.id,
        JSON.stringify(metadata),
        new Date().toISOString(),
        new Date().toISOString()
      )
    }
  }

  private mapOrderPriority(order: any): string {
    // High priority if shipping is overdue
    if (order.shippingStatus === 'OVERDUE') return 'urgent'

    // High priority for large orders
    if (order.netAmountInCompanyCurrency > 5000) return 'high'

    return 'normal'
  }

  private mapOrderStatus(status: string): string {
    const mapping: Record<string, string> = {
      'ORDER_ENTRY_IN_PROGRESS': 'in_progress',
      'ORDER_CONFIRMATION_PRINTED': 'in_progress',
      'DELIVERY_NOTE_PRINTED': 'in_progress',
      'SHIPPED': 'completed',
      'INVOICED': 'completed',
      'CLOSED': 'completed',
      'CANCELLED': 'completed'
    }
    return mapping[status] || 'open'
  }
}
