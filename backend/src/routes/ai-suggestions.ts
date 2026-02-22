import { Router } from 'express'
import { db } from '../db/database.js'
import { WeclappClient } from '../integrations/weclapp/client.js'
import { logAction } from '../utils/actions-log.js'
import { rateLimitedRequest } from '../utils/rate-limiter.js'

export const aiSuggestionsRouter = Router()

const weclapp = new WeclappClient()

// Task type to template category mapping
const TASK_TYPE_CATEGORY_MAP: Record<string, string[]> = {
  order: ['Versand', 'Allgemein'],
  complaint: ['Reklamation'],
  question: ['Allgemein', 'Produktinfo'],
  delay: ['Versand', 'Lieferverzoegerung'],
  payment: ['Finanzen'],
  ticket: ['Reklamation', 'Allgemein']
}

interface SuggestionRequest {
  task_type: 'order' | 'complaint' | 'question' | 'delay' | 'payment' | 'ticket'
  customer_id?: string
  order_id?: string
}

interface TemplateSuggestion {
  template_id: string
  template_name: string
  category: string
  confidence: number
  filled_variables: Record<string, string>
  preview: string
}

// POST /api/ai-suggestions - Get template suggestions with filled variables
aiSuggestionsRouter.post('/', async (req, res) => {
  try {
    const { task_type, customer_id, order_id } = req.body as SuggestionRequest

    if (!task_type) {
      return res.status(400).json({ error: 'task_type is required' })
    }

    // Get matching categories for this task type
    const categories = TASK_TYPE_CATEGORY_MAP[task_type] || ['Allgemein']

    // Fetch templates matching the categories, ordered by usage
    const placeholders = categories.map(() => '?').join(', ')
    const templates = db.prepare(`
      SELECT * FROM templates
      WHERE category IN (${placeholders})
      ORDER BY COALESCE(usage_count, 0) DESC, name ASC
    `).all(...categories) as any[]

    if (templates.length === 0) {
      return res.json({ suggestions: [] })
    }

    // Gather context data
    const context = await gatherContext(customer_id, order_id)

    // Generate suggestions with filled variables
    const suggestions: TemplateSuggestion[] = templates.map((template, index) => {
      const filledVariables = fillVariables(template, context)
      const preview = generatePreview(template, filledVariables)

      // Calculate confidence based on:
      // - Category match (primary category = higher confidence)
      // - Usage count (more used = higher confidence)
      // - Variable fill rate (more filled = higher confidence)
      const categoryIndex = categories.indexOf(template.category)
      const categoryScore = categoryIndex === 0 ? 1 : 0.7
      const usageScore = Math.min(1, (template.usage_count || 0) / 10)
      const fillRate = Object.keys(filledVariables).length / Math.max(1, (template.placeholders ? JSON.parse(template.placeholders).length : 1))

      const confidence = Math.round((categoryScore * 0.4 + usageScore * 0.3 + fillRate * 0.3) * 100) / 100

      return {
        template_id: template.id,
        template_name: template.name,
        category: template.category,
        confidence,
        filled_variables: filledVariables,
        preview
      }
    })

    // Sort by confidence descending
    suggestions.sort((a, b) => b.confidence - a.confidence)

    // Log the suggestion generation
    logAction({
      actor: 'system',
      actionType: 'suggestion_generated',
      entityType: 'suggestion',
      entityId: task_type,
      payload: {
        task_type,
        customer_id,
        order_id,
        suggestion_count: suggestions.length,
        top_suggestion: suggestions[0]?.template_name
      }
    })

    res.json({ suggestions })
  } catch (error) {
    console.error('AI suggestions error:', error)
    res.status(500).json({ error: 'Failed to generate suggestions' })
  }
})

/**
 * Gather context from database and Weclapp
 */
async function gatherContext(customerId?: string, orderId?: string): Promise<Record<string, string>> {
  const context: Record<string, string> = {
    Datum: new Date().toLocaleDateString('de-DE'),
    Uhrzeit: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  }

  // Fetch customer data
  if (customerId) {
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId) as any
    if (customer) {
      context.Kundenname = customer.name || ''
      context.Kundenemail = customer.email || ''
      context.Kundentelefon = customer.phone || ''
      context.Firma = customer.company || ''

      // If customer has weclapp_id, try to get more details
      if (customer.weclapp_id) {
        try {
          const weclappCustomer = await rateLimitedRequest(
            `customer:${customer.weclapp_id}`,
            () => weclapp.getCustomer(customer.weclapp_id)
          )
          if (weclappCustomer) {
            context.Kundennummer = weclappCustomer.customerNumber || ''
          }
        } catch (e) {
          // Weclapp not available, continue with local data
        }
      }
    }
  }

  // Fetch order data from Weclapp
  if (orderId) {
    try {
      const order = await rateLimitedRequest(
        `order:${orderId}`,
        () => weclapp.getSalesOrder(orderId)
      )

      if (order) {
        context.Bestellnummer = order.orderNumber || orderId
        context.Auftragsnummer = order.orderNumber || orderId
        context.Bestelldatum = order.createdDate
          ? new Date(order.createdDate).toLocaleDateString('de-DE')
          : ''
        context.Betrag = order.netAmountInCompanyCurrency
          ? `${order.netAmountInCompanyCurrency.toFixed(2)} EUR`
          : ''
        context.Artikelanzahl = order.orderItems?.length?.toString() || '0'

        // Estimated delivery (7-14 business days from order date)
        if (order.createdDate) {
          const orderDate = new Date(order.createdDate)
          const deliveryDate = new Date(orderDate)
          deliveryDate.setDate(deliveryDate.getDate() + 10) // Approximate
          context.Lieferdatum = deliveryDate.toLocaleDateString('de-DE')
          context.VoraussichtlichesLieferdatum = deliveryDate.toLocaleDateString('de-DE')
        }

        // Tracking info if available
        if (order.trackingNumber) {
          context.Trackingnummer = order.trackingNumber
        }

        // Status
        context.Auftragsstatus = translateOrderStatus(order.salesOrderStatus)
      }
    } catch (e) {
      console.error('Failed to fetch Weclapp order:', e)
    }
  }

  return context
}

/**
 * Fill template variables with context data
 */
function fillVariables(template: any, context: Record<string, string>): Record<string, string> {
  const placeholders = template.placeholders ? JSON.parse(template.placeholders) : []
  const filled: Record<string, string> = {}

  for (const placeholder of placeholders) {
    // Direct match
    if (context[placeholder]) {
      filled[placeholder] = context[placeholder]
      continue
    }

    // Case-insensitive match
    const normalizedPlaceholder = placeholder.toLowerCase()
    for (const [key, value] of Object.entries(context)) {
      if (key.toLowerCase() === normalizedPlaceholder) {
        filled[placeholder] = value
        break
      }
    }

    // Common aliases
    const aliases: Record<string, string[]> = {
      Kundenname: ['Name', 'Kunde', 'Ansprechpartner'],
      Bestellnummer: ['Auftragsnummer', 'OrderNumber', 'Bestell-Nr'],
      Trackingnummer: ['TrackingNumber', 'Sendungsnummer', 'Tracking'],
      Lieferdatum: ['DeliveryDate', 'Zustelldatum', 'VoraussichtlichesLieferdatum'],
      Betrag: ['Summe', 'Gesamtbetrag', 'Amount']
    }

    if (!filled[placeholder]) {
      for (const [canonical, aliasList] of Object.entries(aliases)) {
        if (aliasList.includes(placeholder) && context[canonical]) {
          filled[placeholder] = context[canonical]
          break
        }
      }
    }
  }

  return filled
}

/**
 * Generate a preview of the template with filled variables
 */
function generatePreview(template: any, filledVariables: Record<string, string>): string {
  let preview = template.content

  for (const [key, value] of Object.entries(filledVariables)) {
    const placeholder = `{${key}}`
    preview = preview.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value)
  }

  // Truncate preview to first 200 characters
  if (preview.length > 200) {
    preview = preview.substring(0, 200) + '...'
  }

  return preview
}

/**
 * Translate Weclapp order status to German
 */
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
