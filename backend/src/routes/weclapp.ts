import { Router } from 'express'
import { WeclappClient } from '../integrations/weclapp/client.js'
import { rateLimitedRequest } from '../utils/rate-limiter.js'
import { db } from '../db/database.js'

export const weclappRouter = Router()

// Sync status – when was the last sync, how many records
weclappRouter.get('/sync-status', (req, res) => {
  try {
    const lastSync = db.prepare(`
      SELECT * FROM sync_log WHERE source = 'weclapp' ORDER BY started_at DESC LIMIT 1
    `).get() as any

    const customerCount = (db.prepare('SELECT COUNT(*) as c FROM customers WHERE weclapp_id IS NOT NULL').get() as any)?.c || 0
    const taskCount = (db.prepare("SELECT COUNT(*) as c FROM tasks WHERE source = 'weclapp'").get() as any)?.c || 0

    res.json({
      lastSync: lastSync?.completed_at || null,
      lastStatus: lastSync?.status || 'never',
      customerCount,
      taskCount,
      isConfigured: !!(process.env.WECLAPP_API_TOKEN && process.env.WECLAPP_TENANT)
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Test connection
weclappRouter.get('/test', async (req, res) => {
  try {
    const client = new WeclappClient()
    const isConnected = await client.testConnection()

    if (isConnected) {
      res.json({ status: 'connected', message: 'Weclapp connection successful' })
    } else {
      res.status(503).json({ status: 'disconnected', message: 'Weclapp connection failed' })
    }
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to test Weclapp connection'
    })
  }
})

// Get sales orders
weclappRouter.get('/orders', async (req, res) => {
  try {
    const client = new WeclappClient()
    const { page = 1, pageSize = 20, status } = req.query

    const orders = await client.getSalesOrders(
      Number(page),
      Number(pageSize),
      status as string | undefined
    )
    res.json(orders)
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch orders' })
  }
})

// Get orders at risk of delay
weclappRouter.get('/orders/at-risk', async (req, res) => {
  try {
    const client = new WeclappClient()

    // Fetch recent orders that are not yet shipped
    const ordersResponse = await rateLimitedRequest(
      'orders:at-risk',
      () => client.getSalesOrders(1, 100),
      { cacheTtlMs: 5 * 60 * 1000 } // 5 min cache
    )

    const now = new Date()
    const atRiskOrders: any[] = []

    for (const order of ordersResponse.results) {
      // Skip already shipped or completed orders
      if (['SHIPPED', 'INVOICED', 'CLOSED', 'CANCELLED'].includes(order.salesOrderStatus)) {
        continue
      }

      // Calculate risk based on order age and status
      const createdDate = new Date(order.createdDate)
      const daysOld = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24))

      // Determine risk level
      let riskLevel: 'high' | 'medium' | 'low' = 'low'
      let reason = ''

      // High risk: Order older than 7 days and not shipped
      if (daysOld > 7 && order.salesOrderStatus !== 'SHIPPED') {
        riskLevel = 'high'
        reason = `Auftrag seit ${daysOld} Tagen offen`
      }
      // Medium risk: Order older than 4 days
      else if (daysOld > 4) {
        riskLevel = 'medium'
        reason = `Auftrag seit ${daysOld} Tagen in Bearbeitung`
      }
      // Check if order has expected delivery date that's passed
      else if (order.requestedDeliveryDate) {
        const deliveryDate = new Date(order.requestedDeliveryDate)
        if (deliveryDate < now) {
          riskLevel = 'high'
          reason = 'Gewünschtes Lieferdatum überschritten'
        } else {
          const daysUntilDelivery = Math.floor((deliveryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          if (daysUntilDelivery <= 2 && order.salesOrderStatus === 'ORDER_ENTRY_IN_PROGRESS') {
            riskLevel = 'medium'
            reason = `Nur noch ${daysUntilDelivery} Tage bis zum Lieferdatum`
          }
        }
      }

      // Only include medium and high risk orders
      if (riskLevel !== 'low') {
        // Try to get customer info from local DB
        let customerName = order.customerName || ''
        let customerEmail = ''
        if (order.customerId) {
          const customer = db.prepare('SELECT name, email FROM customers WHERE weclapp_id = ?')
            .get(order.customerId) as any
          if (customer) {
            customerName = customer.name || customerName
            customerEmail = customer.email || ''
          }
        }

        atRiskOrders.push({
          id: order.id,
          orderNumber: order.orderNumber,
          status: translateOrderStatus(order.salesOrderStatus),
          statusCode: order.salesOrderStatus,
          createdDate: order.createdDate,
          daysOld,
          riskLevel,
          reason,
          customer: {
            id: order.customerId,
            name: customerName,
            email: customerEmail
          },
          totalAmount: order.netAmountInCompanyCurrency,
          currency: order.currency?.name || 'EUR',
          itemCount: order.orderItems?.length || 0,
          requestedDeliveryDate: order.requestedDeliveryDate
        })
      }
    }

    // Sort by risk level (high first) then by days old
    atRiskOrders.sort((a, b) => {
      const riskOrder: Record<'high' | 'medium' | 'low', number> = { high: 0, medium: 1, low: 2 }
      const aRisk = a.riskLevel as 'high' | 'medium' | 'low'
      const bRisk = b.riskLevel as 'high' | 'medium' | 'low'
      if (riskOrder[aRisk] !== riskOrder[bRisk]) {
        return riskOrder[aRisk] - riskOrder[bRisk]
      }
      return b.daysOld - a.daysOld
    })

    res.json({
      count: atRiskOrders.length,
      highRisk: atRiskOrders.filter(o => o.riskLevel === 'high').length,
      mediumRisk: atRiskOrders.filter(o => o.riskLevel === 'medium').length,
      orders: atRiskOrders
    })
  } catch (error: any) {
    console.error('At-risk orders error:', error)
    res.status(500).json({ error: error.message || 'Failed to fetch at-risk orders' })
  }
})

function translateOrderStatus(status: string): string {
  const translations: Record<string, string> = {
    ORDER_ENTRY_IN_PROGRESS: 'In Bearbeitung',
    ORDER_CONFIRMATION_PRINTED: 'Bestätigt',
    DELIVERY_NOTE_PRINTED: 'Lieferschein erstellt',
    SHIPPED: 'Versendet',
    INVOICED: 'Fakturiert',
    CLOSED: 'Abgeschlossen',
    CANCELLED: 'Storniert'
  }
  return translations[status] || status
}

// Get single order
weclappRouter.get('/orders/:id', async (req, res) => {
  try {
    const client = new WeclappClient()
    const order = await client.getSalesOrder(req.params.id)
    res.json(order)
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch order' })
  }
})

// Update order status
weclappRouter.patch('/orders/:id', async (req, res) => {
  try {
    const client = new WeclappClient()
    const order = await client.updateSalesOrder(req.params.id, req.body)
    res.json(order)
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to update order' })
  }
})

// Get shipments
weclappRouter.get('/shipments', async (req, res) => {
  try {
    const client = new WeclappClient()
    const { page = 1, pageSize = 20 } = req.query

    const shipments = await client.getShipments(Number(page), Number(pageSize))
    res.json(shipments)
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch shipments' })
  }
})

// Get invoices
weclappRouter.get('/invoices', async (req, res) => {
  try {
    const client = new WeclappClient()
    const { page = 1, pageSize = 20, unpaidOnly } = req.query

    const invoices = await client.getInvoices(
      Number(page),
      Number(pageSize),
      unpaidOnly === 'true'
    )
    res.json(invoices)
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch invoices' })
  }
})

// Get customers
weclappRouter.get('/customers', async (req, res) => {
  try {
    const client = new WeclappClient()
    const { page = 1, pageSize = 20, search } = req.query

    const customers = await client.getCustomers(
      Number(page),
      Number(pageSize),
      search as string | undefined
    )
    res.json(customers)
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch customers' })
  }
})

// Get single customer
weclappRouter.get('/customers/:id', async (req, res) => {
  try {
    const client = new WeclappClient()
    const customer = await client.getCustomer(req.params.id)
    res.json(customer)
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch customer' })
  }
})

// Get stock levels
weclappRouter.get('/stock', async (req, res) => {
  try {
    const client = new WeclappClient()
    const { articleId } = req.query

    if (articleId) {
      const stock = await client.getArticleStock(articleId as string)
      res.json(stock)
    } else {
      const stock = await client.getAllStock()
      res.json(stock)
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch stock' })
  }
})

// Sync data from Weclapp
weclappRouter.post('/sync', async (req, res) => {
  try {
    const client = new WeclappClient()
    const { types = ['customers', 'orders'] } = req.body

    const results = await client.syncAll(types)
    res.json({
      status: 'completed',
      results
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to sync Weclapp data' })
  }
})
