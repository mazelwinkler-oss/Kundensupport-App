/**
 * One-time Gmail OAuth2 setup script
 * Run with: npx tsx src/setup-gmail-oauth.ts
 *
 * Prerequisites:
 * 1. Create OAuth2 Client ID in Google Cloud Console (type: Web Application)
 *    https://console.cloud.google.com/apis/credentials
 * 2. Add Authorized Redirect URI: http://localhost:3000/oauth2callback
 * 3. Add to backend/.env:
 *    GOOGLE_CLIENT_ID=your-client-id
 *    GOOGLE_CLIENT_SECRET=your-client-secret
 *    GMAIL_USER_EMAIL=mail@direktvomhersteller.de
 */

import { google } from 'googleapis'
import * as http from 'http'
import * as url from 'url'
import * as readline from 'readline'
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'

// Load .env from backend directory
const envPath = path.join(process.cwd(), '.env')
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath })
}

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
]

const REDIRECT_URI = 'http://localhost:3000/oauth2callback'

async function main() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const userEmail = process.env.GMAIL_USER_EMAIL || 'mail@direktvomhersteller.de'

  if (!clientId || !clientSecret) {
    console.error('\n❌ Fehler: GOOGLE_CLIENT_ID und GOOGLE_CLIENT_SECRET fehlen in .env\n')
    console.log('Bitte in backend/.env eintragen:')
    console.log('  GOOGLE_CLIENT_ID=<deine-client-id>')
    console.log('  GOOGLE_CLIENT_SECRET=<dein-client-secret>')
    console.log('\nDu findest diese Werte in der Google Cloud Console:')
    console.log('  https://console.cloud.google.com/apis/credentials')
    process.exit(1)
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI)

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent', // force new refresh token
    login_hint: userEmail,
  })

  console.log('\n══════════════════════════════════════════════════════')
  console.log('  Gmail OAuth2 Setup – direktvomhersteller.de')
  console.log('══════════════════════════════════════════════════════')
  console.log('\n1. Öffne diese URL im Browser:')
  console.log('\n   ' + authUrl)
  console.log('\n2. Melde dich mit mail@direktvomhersteller.de an')
  console.log('3. Erteile der App die Berechtigung')
  console.log('4. Du wirst auf localhost:3000 weitergeleitet\n')
  console.log('Warte auf Callback...')

  // Start local server to receive OAuth callback
  const refreshToken = await waitForCallback(oauth2Client)

  console.log('\n══════════════════════════════════════════════════════')
  console.log('  ✅ Erfolgreich! Dein Refresh Token:')
  console.log('══════════════════════════════════════════════════════')
  console.log('\nFüge diese Zeilen in backend/.env ein:\n')
  console.log(`GMAIL_REFRESH_TOKEN=${refreshToken}`)
  console.log(`GMAIL_USER_EMAIL=${userEmail}`)
  console.log('\nDanach Backend neu starten: npm run dev')
  console.log('══════════════════════════════════════════════════════\n')
}

function waitForCallback(oauth2Client: any): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        const parsedUrl = url.parse(req.url || '', true)
        const code = parsedUrl.query.code as string

        if (!code) {
          res.writeHead(400)
          res.end('Kein Code empfangen.')
          server.close()
          reject(new Error('No code in callback'))
          return
        }

        // Exchange code for tokens
        const { tokens } = await oauth2Client.getToken(code)

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(`
          <html>
            <body style="font-family: sans-serif; padding: 40px; text-align: center;">
              <h1 style="color: #16a34a;">✅ Erfolgreich!</h1>
              <p>Du kannst dieses Fenster jetzt schließen.</p>
              <p style="color: #6b7280;">Schau zurück ins Terminal für deinen Refresh Token.</p>
            </body>
          </html>
        `)

        server.close()

        if (!tokens.refresh_token) {
          reject(new Error(
            'Kein Refresh Token erhalten. Stelle sicher dass prompt=consent gesetzt ist und du einen neuen Grant erstellst.'
          ))
          return
        }

        resolve(tokens.refresh_token)
      } catch (err) {
        res.writeHead(500)
        res.end('Fehler beim Token-Austausch: ' + String(err))
        server.close()
        reject(err)
      }
    })

    server.listen(3000, () => {
      // Server is ready, URL was already printed above
    })

    server.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        console.error('\n❌ Port 3000 ist bereits belegt.')
        console.error('Bitte stoppe andere Prozesse auf Port 3000 und versuche es erneut.\n')
      }
      reject(err)
    })

    // Timeout after 5 minutes
    setTimeout(() => {
      server.close()
      reject(new Error('Timeout: Kein Callback nach 5 Minuten erhalten.'))
    }, 5 * 60 * 1000)
  })
}

main().catch(err => {
  console.error('\n❌ Fehler:', err.message)
  process.exit(1)
})
