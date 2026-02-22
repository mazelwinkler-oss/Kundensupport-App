/**
 * Gmail integration via Google Service Account + Domain-Wide Delegation
 * Reads inbox and sends emails on behalf of mail@direktvomhersteller.de
 * No OAuth redirect needed – works fully server-side.
 */

import { google } from 'googleapis'
import * as fs from 'fs'
import * as path from 'path'

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

function getServiceAccountCredentials(): object | null {
  // Option 1: path to JSON key file
  const keyFile = process.env.GMAIL_SERVICE_ACCOUNT_KEY_FILE
  if (keyFile) {
    try {
      const resolved = path.isAbsolute(keyFile)
        ? keyFile
        : path.join(process.cwd(), keyFile)
      return JSON.parse(fs.readFileSync(resolved, 'utf8'))
    } catch (e: any) {
      console.error('[Gmail] Could not read key file:', e.message)
    }
  }

  // Option 2: inline JSON in env var
  const keyJson = process.env.GMAIL_SERVICE_ACCOUNT_KEY_JSON
  if (keyJson) {
    try {
      return JSON.parse(keyJson)
    } catch (e: any) {
      console.error('[Gmail] Could not parse GMAIL_SERVICE_ACCOUNT_KEY_JSON:', e.message)
    }
  }

  return null
}

export function isGmailConfigured(): boolean {
  return !!(
    (process.env.GMAIL_SERVICE_ACCOUNT_KEY_FILE || process.env.GMAIL_SERVICE_ACCOUNT_KEY_JSON) &&
    process.env.GMAIL_USER_EMAIL
  )
}

function getAuthClient(userEmail: string) {
  const credentials = getServiceAccountCredentials()
  if (!credentials) throw new Error('Gmail Service Account credentials not found')

  const auth = new google.auth.GoogleAuth({
    credentials: credentials as any,
    scopes: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.modify',
    ],
    clientOptions: {
      subject: userEmail, // impersonate this user (Domain-Wide Delegation)
    },
  })
  return auth
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
  const userEmail = process.env.GMAIL_USER_EMAIL!
  const auth = getAuthClient(userEmail)
  const gmail = google.gmail({ version: 'v1', auth: await auth.getClient() as any })

  // List messages in inbox
  const listRes = await gmail.users.messages.list({
    userId: 'me',
    labelIds: ['INBOX'],
    maxResults,
  })

  const messageIds = listRes.data.messages || []
  if (messageIds.length === 0) return []

  // Fetch each message in parallel (batched)
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
  const auth = getAuthClient(userEmail)
  const gmail = google.gmail({ version: 'v1', auth: await auth.getClient() as any })

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
  const userEmail = process.env.GMAIL_USER_EMAIL!
  const auth = getAuthClient(userEmail)
  const gmail = google.gmail({ version: 'v1', auth: await auth.getClient() as any })
  await gmail.users.messages.modify({
    userId: 'me',
    id: messageId,
    requestBody: { removeLabelIds: ['UNREAD'] },
  })
}
