/**
 * Gmail integration via OAuth2 Refresh Token
 * Reads inbox and sends emails on behalf of mail@direktvomhersteller.de
 *
 * Setup (one-time):
 * 1. Create OAuth2 Client ID in Google Cloud Console (type: Web Application)
 * 2. Add redirect URI: http://localhost:3000/oauth2callback
 * 3. Add GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET to .env
 * 4. Run: npx tsx src/setup-gmail-oauth.ts
 * 5. Add GMAIL_REFRESH_TOKEN to .env
 */

import { google } from 'googleapis'

export interface GmailMessage {
  id: string
  subject: string
  from: { name?: string; address: string }
  receivedAt: string
  preview: string
  body: string
  isRead: boolean
  threadId: string
}

export function isGmailConfigured(): boolean {
  return !!(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GMAIL_REFRESH_TOKEN &&
    process.env.GMAIL_USER_EMAIL
  )
}

function getOAuth2Client() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'http://localhost:3000/oauth2callback'
  )
  oauth2Client.setCredentials({
    refresh_token: process.env.GMAIL_REFRESH_TOKEN,
  })
  return oauth2Client
}

function decodeBase64Url(str: string): string {
  return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
}

function extractBody(payload: any): string {
  if (!payload) return ''

  // Direct body
  if (payload.body?.data) {
    return decodeBase64Url(payload.body.data)
  }

  // Multipart – prefer text/plain, fallback to text/html
  if (payload.parts) {
    const textPart = payload.parts.find((p: any) => p.mimeType === 'text/plain')
    if (textPart?.body?.data) return decodeBase64Url(textPart.body.data)

    const htmlPart = payload.parts.find((p: any) => p.mimeType === 'text/html')
    if (htmlPart?.body?.data) return decodeBase64Url(htmlPart.body.data)

    // Nested multipart
    for (const part of payload.parts) {
      const nested = extractBody(part)
      if (nested) return nested
    }
  }

  return ''
}

function getHeader(headers: any[], name: string): string {
  return headers?.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || ''
}

function parseEmailAddress(raw: string): { name?: string; address: string } {
  const match = raw.match(/^(.*?)\s*<(.+?)>$/)
  if (match) return { name: match[1].trim().replace(/^"|"$/g, ''), address: match[2].trim() }
  return { address: raw.trim() }
}

export async function getInboxMessages(maxResults = 50): Promise<GmailMessage[]> {
  const auth = getOAuth2Client()
  const gmail = google.gmail({ version: 'v1', auth })

  // List messages in inbox
  const listRes = await gmail.users.messages.list({
    userId: 'me',
    labelIds: ['INBOX'],
    maxResults,
  })

  const messageIds = listRes.data.messages || []
  if (messageIds.length === 0) return []

  // Fetch each message in parallel
  const messages = await Promise.all(
    messageIds.map(async ({ id }) => {
      try {
        const msg = await gmail.users.messages.get({
          userId: 'me',
          id: id!,
          format: 'full',
        })
        const data = msg.data
        const headers = data.payload?.headers || []

        const subjectRaw = getHeader(headers, 'Subject')
        const fromRaw = getHeader(headers, 'From')
        const dateRaw = getHeader(headers, 'Date')
        const from = parseEmailAddress(fromRaw)
        const body = extractBody(data.payload)
        const isRead = !data.labelIds?.includes('UNREAD')

        return {
          id: data.id!,
          subject: subjectRaw || '(kein Betreff)',
          from,
          receivedAt: dateRaw ? new Date(dateRaw).toISOString() : new Date().toISOString(),
          preview: data.snippet || '',
          body,
          isRead,
          threadId: data.threadId || data.id!,
        } as GmailMessage
      } catch {
        return null
      }
    })
  )

  return messages.filter(Boolean) as GmailMessage[]
}

export async function sendGmailMessage(params: {
  to: string
  subject: string
  body: string
  replyToMessageId?: string
}): Promise<void> {
  const userEmail = process.env.GMAIL_USER_EMAIL!
  const auth = getOAuth2Client()
  const gmail = google.gmail({ version: 'v1', auth })

  const mimeLines = [
    `From: ${userEmail}`,
    `To: ${params.to}`,
    `Subject: ${params.subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    '',
    params.body,
  ]

  const raw = Buffer.from(mimeLines.join('\r\n'))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw, threadId: params.replyToMessageId },
  })
}

export async function markAsRead(messageId: string): Promise<void> {
  const auth = getOAuth2Client()
  const gmail = google.gmail({ version: 'v1', auth })
  await gmail.users.messages.modify({
    userId: 'me',
    id: messageId,
    requestBody: { removeLabelIds: ['UNREAD'] },
  })
}
