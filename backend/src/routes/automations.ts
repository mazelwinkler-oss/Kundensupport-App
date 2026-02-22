import { Router } from 'express'
import { db } from '../db/database.js'
import { randomUUID } from 'crypto'

export const automationsRouter = Router()

// Black Book communication rules for prompt generation
const BLACK_BOOK_RULES = `
Kommunikationsregeln (Black Book – Sebastian Fröder):
1. Klarheit schlägt Komplexität: Wenige, klare Botschaften. Max 3 Kernaussagen.
2. Nutzen vor Eigenschaften: "Sie haben Planungssicherheit" statt "Wir nutzen System X"
3. Klare Sprache: Keine Weichmacher ("Wir übernehmen das" statt "Wir schauen mal")
4. Anrede: Immer "Hallo Herr/Frau [Nachname]" – niemals "Sehr geehrte/r"
5. Abschluss: "Viele Grüße, [Name], direktvomhersteller.de"
`

const PATTERN_DEFINITIONS: Record<string, {
  title: string
  description: (freq: number) => string
  n8nWorkflow: string
  claudePrompt: string
}> = {
  shipping_confirmation: {
    title: 'Versandbestätigungen automatisieren',
    description: (freq) => `Sie haben diese Woche ${freq}x manuell Versandbestätigungen gesendet.`,
    n8nWorkflow: `Trigger: Weclapp Webhook → Auftrag Status = "SHIPPED"
Aktion 1: GET /api/customers/external/weclapp/{{customerId}} → Kundendaten laden
Aktion 2: POST /api/email/send → Template "Versandbestätigung" mit Variablen:
  - Anrede: {{customer.salutation}}
  - Nachname: {{customer.lastName}}
  - Bestellnummer: {{order.orderNumber}}
  - Lieferdatum: {{order.expectedDeliveryDate}}
  - Trackingnummer: {{shipment.trackingNumber}}
  - Supportname: Marcel`,
    claudePrompt: `Erstelle einen n8n-Workflow der automatisch eine Versandbestätigung sendet wenn ein Weclapp-Auftrag den Status SHIPPED bekommt.

Weclapp Webhook URL: https://[tenant].weclapp.com/webapp/api/v1/salesOrder
Trigger-Bedingung: salesOrderStatus = "SHIPPED"

Die E-Mail soll folgendes Format haben (Black Book Stil):
Betreff: "Ihre Bestellung [Bestellnummer] ist unterwegs"
Text: "Hallo Herr/Frau [Nachname], Ihre Bestellung ist unterwegs – Sie bekommen Ihr Paket am [Lieferdatum]. Tracking: [Trackingnummer]. Bei Fragen bin ich direkt für Sie erreichbar. Viele Grüße, Marcel, direktvomhersteller.de"

Nutze folgende API-Endpunkte:
- GET /api/weclapp/customers/[id] für Kundendaten
- POST /api/email/send für den Versand`
  },
  payment_reminder: {
    title: 'Zahlungserinnerungen automatisieren',
    description: (freq) => `Sie haben diese Woche ${freq}x Zahlungserinnerungen manuell versendet.`,
    n8nWorkflow: `Trigger: Cron-Job täglich 09:00 Uhr
Aktion 1: GET /api/weclapp/invoices?unpaidOnly=true → Alle offenen Rechnungen
Aktion 2: Filter → Rechnungen älter als 14 Tage
Aktion 3: POST /api/email/send → Template "Zahlungserinnerung" für jeden Kunden`,
    claudePrompt: `Erstelle einen n8n-Workflow der jeden Morgen um 09:00 Uhr alle offenen Rechnungen aus Weclapp prüft und für Rechnungen die älter als 14 Tage sind automatisch eine Zahlungserinnerung sendet.

Format (Black Book Stil):
Betreff: "Offene Rechnung [Rechnungsnummer] – kurze Erinnerung"
Text: "Hallo Herr/Frau [Nachname], Rechnung [Rechnungsnummer] vom [Datum] über [Betrag] EUR ist noch offen. Falls die Zahlung bereits unterwegs ist – alles gut. Bei Rückfragen bin ich direkt für Sie da. Viele Grüße, Marcel"

API: GET /api/weclapp/invoices?unpaidOnly=true`
  },
  ticket_response: {
    title: 'Reklamations-Eingangsbestätigungen automatisieren',
    description: (freq) => `Sie haben diese Woche ${freq}x Reklamationen manuell bestätigt.`,
    n8nWorkflow: `Trigger: Weclapp Webhook → Neues Ticket / neue Aufgabe mit type = "ticket"
Aktion 1: Kundendaten laden
Aktion 2: Ticket-Nummer generieren
Aktion 3: POST /api/email/send → Template "Reklamation – Eingang bestätigt"`,
    claudePrompt: `Erstelle einen n8n-Workflow der automatisch eine Eingangsbestätigung sendet sobald ein neues Support-Ticket in der Kundensupport-App erstellt wird.

Die Bestätigung soll den Kunden informieren dass sein Anliegen eingegangen ist und er innerhalb von 24h eine Rückmeldung bekommt.

Format (Black Book Stil):
Betreff: "Wir kümmern uns – Reklamation [Ticketnummer]"
Text: "Hallo Herr/Frau [Nachname], wir haben Ihr Anliegen erhalten und kümmern uns darum. Ticketnummer: [Nummer]. Sie bekommen innerhalb von 24 Stunden eine Rückmeldung. Viele Grüße, Marcel"

Webhook: POST /api/webhooks mit event="task.created" und type="ticket"`
  },
  lead_followup: {
    title: 'Lead Follow-ups automatisieren',
    description: (freq) => `${freq} Leads warten auf Follow-up.`,
    n8nWorkflow: `Trigger: Cron-Job täglich 08:30 Uhr
Aktion 1: GET /api/tasks?type=lead&status=open → Alle offenen Leads
Aktion 2: Filter → Leads älter als 2 Tage ohne Aktivität
Aktion 3: Erstelle Erinnerungsaufgabe in der App`,
    claudePrompt: `Erstelle einen n8n-Workflow der jeden Morgen prüft ob Leads seit mehr als 2 Tagen offen sind ohne Aktivität. Für diese Leads soll automatisch eine Erinnerungsaufgabe erstellt werden.

API: GET /api/tasks?type=lead&status=open
POST /api/tasks → Neue Erinnerungsaufgabe mit priority="high" und due_date=heute`
  }
}

// GET /api/automations – Get automation suggestions with prompts
automationsRouter.get('/', (req, res) => {
  try {
    const patterns = db.prepare(`
      SELECT * FROM activity_patterns
      WHERE frequency >= 5
      ORDER BY frequency DESC
      LIMIT 10
    `).all() as any[]

    const suggestions = patterns
      .filter(p => PATTERN_DEFINITIONS[p.pattern_type])
      .map(p => {
        const def = PATTERN_DEFINITIONS[p.pattern_type]
        return {
          id: p.id,
          patternType: p.pattern_type,
          title: def.title,
          description: def.description(p.frequency),
          frequency: p.frequency,
          lastOccurrence: p.last_occurrence,
          n8nWorkflow: def.n8nWorkflow,
          claudePrompt: def.claudePrompt + '\n\n' + BLACK_BOOK_RULES,
          blackBookRules: BLACK_BOOK_RULES.trim()
        }
      })

    res.json({ suggestions })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// POST /api/automations/track – Track an action for pattern detection
automationsRouter.post('/track', (req, res) => {
  try {
    const { actionType } = req.body
    if (!actionType) return res.status(400).json({ error: 'actionType required' })

    const now = new Date().toISOString()
    const existing = db.prepare(
      'SELECT * FROM activity_patterns WHERE pattern_type = ?'
    ).get(actionType) as any

    if (existing) {
      db.prepare(`
        UPDATE activity_patterns
        SET frequency = frequency + 1, last_occurrence = ?
        WHERE pattern_type = ?
      `).run(now, actionType)
    } else {
      db.prepare(`
        INSERT INTO activity_patterns (id, pattern_type, frequency, last_occurrence, created_at)
        VALUES (?, ?, 1, ?, ?)
      `).run(randomUUID(), actionType, now, now)
    }

    res.json({ success: true })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})
