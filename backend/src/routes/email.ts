import { Router } from 'express'
import axios from 'axios'
import { db } from '../db/database.js'
import { randomUUID } from 'crypto'
import { WeclappClient } from '../integrations/weclapp/client.js'
import {
  isGmailConfigured,
  getInboxMessages,
  sendGmailMessage,
  markAsRead,
} from '../integrations/gmail/client.js'

export const emailRouter = Router()
const weclappClient = new WeclappClient()

// Get Microsoft Graph access token via Client Credentials
async function getMicrosoftToken(): Promise<string | null> {
  const tenantId = process.env.MICROSOFT_TENANT_ID
  const clientId = process.env.MICROSOFT_CLIENT_ID
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET

  if (!tenantId || !clientId || !clientSecret) {
    return null
  }

  try {
    const response = await axios.post(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
        scope: 'https://graph.microsoft.com/.default',
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    )
    return response.data.access_token
  } catch (error: any) {
    console.error('[Email] Token error:', error.response?.data || error.message)
    return null
  }
}

// POST /api/email/send
emailRouter.post('/send', async (req, res) => {
  const { to, subject, body, customerId, taskId, templateId } = req.body

  if (!to || !body) {
    return res.status(400).json({ error: 'to and body are required' })
  }

  const senderEmail = process.env.MICROSOFT_SENDER_EMAIL || 'support@direktvomhersteller.de'
  const token = await getMicrosoftToken()
  let method: 'graph' | 'mailto' = 'mailto'
  let success = false

  // Try Gmail first (if configured)
  if (isGmailConfigured()) {
    try {
      await sendGmailMessage({ to, subject: subject || '(kein Betreff)', body })
      method = 'graph' // reuse 'graph' to signal server-side send
      success = true
      console.log('[Email] Sent via Gmail')
    } catch (error: any) {
      console.error('[Email] Gmail send error:', error.message)
    }
  }

  // Try Microsoft Graph (if Gmail not used)
  if (!success && token) {
    try {
      await axios.post(
        `https://graph.microsoft.com/v1.0/users/${senderEmail}/sendMail`,
        {
          message: {
            subject: subject || '(kein Betreff)',
            body: { contentType: 'Text', content: body },
            toRecipients: [{ emailAddress: { address: to } }],
          },
          saveToSentItems: true,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      )
      method = 'graph'
      success = true
    } catch (error: any) {
      console.error('[Email] Graph send error:', error.response?.data || error.message)
    }
  }

  // Save to local emails table regardless of send method
  try {
    const emailId = randomUUID()
    db.prepare(`
      INSERT INTO emails (id, customer_id, direction, subject, body, recipient_email, sent_at, weclapp_synced, template_id, task_id)
      VALUES (?, ?, 'outbound', ?, ?, ?, ?, 0, ?, ?)
    `).run(
      emailId,
      customerId || null,
      subject || null,
      body,
      to,
      new Date().toISOString(),
      templateId || null,
      taskId || null
    )

    // Also create a Weclapp comment so the email appears in Weclapp history
    if (customerId) {
      const customer = db.prepare('SELECT weclapp_id FROM customers WHERE id = ?').get(customerId) as { weclapp_id: string } | undefined
      if (customer?.weclapp_id) {
        const commentText = `📧 E-Mail an: ${to}\n\nBetreff: ${subject || '(kein Betreff)'}\n\n${body}`
        weclappClient.createCustomerComment(customer.weclapp_id, commentText, subject)
          .then(() => {
            db.prepare('UPDATE emails SET weclapp_synced = 1 WHERE id = ?').run(emailId)
          })
          .catch(err => console.error('[Email] Weclapp comment failed:', err.message))
      }
    }
  } catch (dbErr: any) {
    console.error('[Email] DB save error:', dbErr.message)
  }

  if (success) {
    return res.json({ success: true, method: 'graph' })
  }

  // Fallback: return mailto link
  const mailtoLink = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject || '')}&body=${encodeURIComponent(body)}`
  return res.json({ success: false, method: 'mailto', mailtoLink })
})

// GET /api/email/status – check which provider is configured
emailRouter.get('/status', async (_req, res) => {
  if (isGmailConfigured()) {
    return res.json({ configured: true, method: 'gmail', provider: 'gmail' })
  }
  const graphConfigured = !!(
    process.env.MICROSOFT_TENANT_ID &&
    process.env.MICROSOFT_CLIENT_ID &&
    process.env.MICROSOFT_CLIENT_SECRET
  )
  res.json({
    configured: graphConfigured,
    method: graphConfigured ? 'microsoft_graph' : 'mailto_fallback',
    provider: graphConfigured ? 'microsoft' : null,
  })
})

// GET /api/email/inbox – inbox from Gmail or Microsoft Graph, matched to customers
emailRouter.get('/inbox', async (_req, res) => {
  // ── Gmail ──────────────────────────────────────────────────────────────
  if (isGmailConfigured()) {
    try {
      const messages = await getInboxMessages(50)
      const enriched = messages.map(msg => {
        const customer = msg.from.address
          ? db.prepare('SELECT id, name FROM customers WHERE email = ? COLLATE NOCASE')
              .get(msg.from.address) as { id: string; name: string } | undefined
          : undefined
        return { ...msg, customerId: customer?.id, customerName: customer?.name, source: 'gmail' }
      })
      return res.json({ configured: true, provider: 'gmail', emails: enriched, total: enriched.length })
    } catch (error: any) {
      console.error('[Email] Gmail inbox error:', error.message)
      return res.status(500).json({ error: 'Gmail Postfach konnte nicht geladen werden', details: error.message })
    }
  }

  // ── Microsoft Graph ────────────────────────────────────────────────────
  const senderEmail = process.env.MICROSOFT_SENDER_EMAIL || 'mail@direktvomhersteller.de'
  const token = await getMicrosoftToken()

  if (token) {
    try {
      const response = await axios.get(
        `https://graph.microsoft.com/v1.0/users/${senderEmail}/mailFolders/inbox/messages`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: {
            $top: 50,
            $orderby: 'receivedDateTime desc',
            $select: 'id,subject,from,toRecipients,receivedDateTime,bodyPreview,isRead,body',
          },
        }
      )
      const messages = response.data.value || []
      const enriched = messages.map((msg: any) => {
        const senderAddr = msg.from?.emailAddress?.address || ''
        const customer = senderAddr
          ? db.prepare('SELECT id, name FROM customers WHERE email = ? COLLATE NOCASE')
              .get(senderAddr) as { id: string; name: string } | undefined
          : undefined
        return {
          id: msg.id,
          subject: msg.subject,
          from: msg.from?.emailAddress,
          receivedAt: msg.receivedDateTime,
          preview: msg.bodyPreview,
          body: msg.body?.content || msg.bodyPreview,
          isRead: msg.isRead,
          threadId: msg.id,
          customerId: customer?.id,
          customerName: customer?.name,
          source: 'microsoft_graph',
        }
      })
      return res.json({ configured: true, provider: 'microsoft', emails: enriched, total: enriched.length })
    } catch (error: any) {
      console.error('[Email] Graph inbox error:', error.response?.data || error.message)
    }
  }

  // ── Not configured ─────────────────────────────────────────────────────
  return res.json({
    configured: false,
    provider: null,
    message: 'Kein E-Mail-Provider konfiguriert.',
    emails: [],
  })
})

// POST /api/email/inbox/:id/read – mark message as read
emailRouter.post('/inbox/:id/read', async (req, res) => {
  if (isGmailConfigured()) {
    try {
      await markAsRead(req.params.id)
      return res.json({ success: true })
    } catch (e: any) {
      return res.status(500).json({ error: e.message })
    }
  }
  res.json({ success: false, reason: 'not_configured' })
})

// GET /api/email/history/:customerId – sent emails + Weclapp activities
emailRouter.get('/history/:customerId', async (req, res) => {
  const { customerId } = req.params

  // Local sent emails
  const localEmails = db.prepare(`
    SELECT id, direction, subject, body, recipient_email, sent_at, weclapp_synced
    FROM emails
    WHERE customer_id = ?
    ORDER BY sent_at DESC
    LIMIT 50
  `).all(customerId) as any[]

  // Weclapp activities (comments, notes)
  let weclappActivities: any[] = []
  try {
    const customer = db.prepare('SELECT weclapp_id FROM customers WHERE id = ?').get(customerId) as { weclapp_id: string } | undefined
    if (customer?.weclapp_id) {
      const raw = await weclappClient.getCustomerActivities(customer.weclapp_id)
      weclappActivities = (raw || []).map((a: any) => ({
        id: `weclapp-${a.id}`,
        direction: 'outbound',
        subject: a.subject || a.title || 'Weclapp-Notiz',
        body: a.comment || a.text || a.description || '',
        sentAt: a.createdDate ? new Date(a.createdDate).toISOString() : new Date().toISOString(),
        source: 'weclapp',
      }))
    }
  } catch (e: any) {
    console.error('[Email] Weclapp activities error:', e.message)
  }

  // Merge and sort by date desc
  const all = [
    ...localEmails.map(e => ({
      id: e.id,
      direction: e.direction,
      subject: e.subject,
      body: e.body,
      sentAt: e.sent_at,
      recipientEmail: e.recipient_email,
      source: 'local',
    })),
    ...weclappActivities,
  ].sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())

  res.json({ emails: all, total: all.length })
})
