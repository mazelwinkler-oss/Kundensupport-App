import { Router } from 'express'
import axios from 'axios'

export const emailRouter = Router()

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
  const { to, subject, body, senderEmail } = req.body

  if (!to || !subject || !body) {
    return res.status(400).json({ error: 'to, subject and body are required' })
  }

  // Try Microsoft Graph first
  const token = await getMicrosoftToken()

  if (token && senderEmail) {
    try {
      await axios.post(
        `https://graph.microsoft.com/v1.0/users/${senderEmail}/sendMail`,
        {
          message: {
            subject,
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

      return res.json({ success: true, method: 'graph' })
    } catch (error: any) {
      console.error('[Email] Graph send error:', error.response?.data || error.message)
      // Fall through to mailto fallback
    }
  }

  // Fallback: return mailto link so frontend can open it
  const mailtoLink = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  return res.json({ success: false, method: 'mailto', mailtoLink })
})

// GET /api/email/status - Check if Graph is configured
emailRouter.get('/status', async (req, res) => {
  const configured = !!(
    process.env.MICROSOFT_TENANT_ID &&
    process.env.MICROSOFT_CLIENT_ID &&
    process.env.MICROSOFT_CLIENT_SECRET
  )
  res.json({ configured, method: configured ? 'microsoft_graph' : 'mailto_fallback' })
})
