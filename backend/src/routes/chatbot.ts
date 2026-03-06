import { Router } from 'express'
import { db } from '../db/database.js'
import { randomUUID } from 'crypto'

export const chatbotRouter = Router()

// Seed initial product knowledge if empty
function seedKnowledge() {
  const count = (db.prepare('SELECT COUNT(*) as c FROM chatbot_knowledge').get() as any)?.c || 0
  if (count > 0) return

  const entries = [
    {
      question: 'Wie lange dauert die Lieferung',
      answer: 'Die Lieferzeit hängt vom Modell ab: StandardModelle werden in 2–5 Werktagen geliefert. Bei Spezialmodellen und Outdoor-Whirlpools kann es 4–16 Wochen dauern. Die genaue Lieferzeit steht auf der Produktseite.',
      category: 'Lieferung',
      keywords: 'lieferzeit,lieferung,wann,dauert,versand'
    },
    {
      question: 'Was ist der Unterschied zwischen MultiSpa Deluxe und Excellent',
      answer: 'MultiSpa Excellent hat mehr Düsen, stärkere Pumpen und mehr Funktionen als Deluxe. Deluxe ist der Einstieg, Excellent bietet mehr Massagepower. Excellent eignet sich besonders wenn Sie therapeutische Wirkung wünschen.',
      category: 'Produkte',
      keywords: 'deluxe,excellent,unterschied,vergleich,multispa'
    },
    {
      question: 'Welcher Whirlpool passt in mein Badezimmer',
      answer: 'Für ein Standardbadezimmer eignen sich unsere kompakten Modelle ab 140x70cm. Messen Sie Ihren verfügbaren Platz und ich nenne Ihnen die passenden Modelle. Wichtig: Türbreite und Treppen beachten für die Lieferung.',
      category: 'Beratung',
      keywords: 'badezimmer,passt,größe,maße,platz'
    },
    {
      question: 'Gibt es eine Garantie',
      answer: 'Alle SpaVida®-Produkte kommen mit 2 Jahren gesetzlicher Gewährleistung. Zusätzlich bieten wir einen erweiterten Service. Bei Problemen wenden Sie sich direkt an uns – wir kümmern uns darum.',
      category: 'Service',
      keywords: 'garantie,gewährleistung,defekt,kaputt'
    },
    {
      question: 'Was kostet ein Outdoor Whirlpool',
      answer: 'Unsere Outdoor-Whirlpools starten ab 7.490 € für Einstiegsmodelle. Premium-Modelle mit Balboa-System kosten zwischen 10.000 € und 14.490 €. Aktuell haben wir auch Angebote – schauen Sie gerne unter direktvomhersteller.de/angebote.',
      category: 'Produkte',
      keywords: 'outdoor,preis,kosten,outdoor-whirlpool,außen,garten'
    },
    {
      question: 'Kann ich auf Rechnung bestellen',
      answer: 'Ja, wir bieten verschiedene Zahlungsmöglichkeiten an. Bei Fragen zu Zahlungsmodalitäten kontaktieren Sie uns direkt – wir finden die für Sie passende Lösung.',
      category: 'Zahlung',
      keywords: 'rechnung,zahlung,finanzierung,bezahlen'
    },
    {
      question: 'Wie wird der Whirlpool geliefert und aufgestellt',
      answer: 'Die Lieferung erfolgt per Spedition bis zur Bordsteinkante oder nach Vereinbarung ins Haus. Aufstellung und Anschluss können wir auf Anfrage koordinieren. Bitte stellen Sie sicher dass der Weg zum Aufstellort zugänglich ist.',
      category: 'Lieferung',
      keywords: 'lieferung,aufstellung,montage,anschluss,spedition'
    },
    {
      question: 'Was sind Eiswannen und wofür sind sie',
      answer: 'Unsere Eiswannen sind für Kältetherapie und Recovery. Sie werden von Sportlern und zur Regeneration genutzt. Die Wassertemperatur kann auf 5–15 Grad gekühlt werden. Sehr beliebt bei Fitness-Enthusiasten.',
      category: 'Produkte',
      keywords: 'eiswanne,eisbad,kälte,recovery,sport'
    }
  ]


  const insert = db.prepare(`
    INSERT INTO chatbot_knowledge (id, question, answer, category, keywords, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)
  const now = new Date().toISOString()
  for (const e of entries) {
    insert.run(randomUUID(), e.question, e.answer, e.category, e.keywords, now, now)
  }
  console.log('[Chatbot] Seeded initial knowledge base')
}

// Simple keyword matching
function findBestAnswer(question: string): { answer: string; confidence: number; category: string } | null {
  const q = question.toLowerCase()
  const entries = db.prepare('SELECT * FROM chatbot_knowledge ORDER BY use_count DESC').all() as any[]

  let bestMatch: { entry: any; score: number } | null = null

  for (const entry of entries) {
    let score = 0
    const keywords = (entry.keywords || '').toLowerCase().split(',').map((k: string) => k.trim())
    const entryQuestion = entry.question.toLowerCase()

    // Keyword matches
    for (const kw of keywords) {
      if (kw && q.includes(kw)) score += 3
    }

    // Question similarity
    const entryWords = entryQuestion.split(/s+/)
    for (const word of entryWords) {
      if (word.length > 3 && q.includes(word)) score += 1
    }

    if (score > 0 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { entry, score }
    }
  }

  if (!bestMatch || bestMatch.score < 2) return null

  // Update use count
  db.prepare('UPDATE chatbot_knowledge SET use_count = use_count + 1 WHERE id = ?').run(bestMatch.entry.id)

  return {
    answer: bestMatch.entry.answer,
    confidence: Math.min(1, bestMatch.score / 10),
    category: bestMatch.entry.category
  }
}

// Upsert SOP & Operations knowledge (runs every startup, INSERT OR IGNORE by question hash)
function upsertSopKnowledge() {
  const upsert = db.prepare(`
    INSERT OR IGNORE INTO chatbot_knowledge (id, question, answer, category, keywords, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)
  const now = new Date().toISOString()

  const sopEntries = [
    {
      id: 'sop-001',
      question: 'Was ist meine tägliche Routine und Reihenfolge',
      answer: `Tages-SOP (5 Blöcke):
① 08:00–08:15 SCAN: HubSpot Heiße-Lead-Liste + SLA-Alarm + Gmail prüfen. Nur schauen, nicht bearbeiten.
② 08:15–09:45 LEADS: Direkte Anfragen → Heiße Leads → Warme Leads → Neue Meta-Leads scoren. Anrufe JETZT.
③ 09:45–10:15 WECLAPP: Bestellungen, Versand anstoßen, überfällige Lieferungen, offene Rechnungen.
④ 10:15–11:45 TICKETS: SLA-Reihe strikt einhalten: Überschritten → Reklamation/Defekt (4h) → Produktfrage kaufnah (4h) → Lieferstatus (24h) → Installation (24h) → Allgemein (48h).
⑤ 11:45–12:15 DASHBOARD: Abschluss, Morgen vorbereiten, Compliance prüfen.
Nachmittag: Rückrufe, Versand, Templates, Meta-Lead-Scoring.`,
      category: 'SOP',
      keywords: 'routine,tagesplan,reihenfolge,sop,ablauf,morgen,tagesablauf,zeitplan,block'
    },
    {
      id: 'sop-002',
      question: 'Welche Priorität haben Leads gegenüber Tickets',
      answer: `Prioritätsregel: Heiße Leads IMMER vor Tickets – mit einer Ausnahme.

Leads gehen vor, weil: Umsatz entsteht heute. Ein verpasster heißer Lead = 4.500 € weg.
Tickets gehen vor wenn: SLA-Status "Überschritten" bei Reklamation oder Defekt.

Reihenfolge:
1. SLA-Eskalation Reklamation/Defekt (4h überschritten)
2. Direkte Anfragen (Gold – <1h Reaktion)
3. Heiße Leads (Score 70+)
4. Produktfragen kaufnah (Umsatz-kritisch! 4h SLA)
5. Warme Leads
6. Alle anderen Tickets
7. Kalte Leads (laufen automatisch via Sequenz C)`,
      category: 'SOP',
      keywords: 'priorität,reihenfolge,leads,tickets,zuerst,wichtig,dringend,wann'
    },
    {
      id: 'sop-003',
      question: 'Was sind die SLA Zeiten für Tickets',
      answer: `SLA-Zeiten (Service Level Agreement – maximale Reaktionszeit):

🔴 4 Stunden (Urgent):
- Reklamation / Schaden bei Lieferung → Template tkt-1
- Technischer Defekt nach Inbetriebnahme → Template tkt-5
- Produktfrage kaufnah (Umsatz!) → Template tkt-3

🟡 24 Stunden (Hoch):
- Lieferstatus-Anfrage → Template tkt-2
- Installationsfrage → Template tkt-4

🟢 48 Stunden (Normal):
- Allgemeine Anfragen

Wenn SLA überschritten: HubSpot zeigt "Überschritten" in rot → sofort bearbeiten, alles andere wartet.`,
      category: 'SOP',
      keywords: 'sla,reaktionszeit,ticket,stunden,frist,wann,antworten,zeit,deadline'
    },
    {
      id: 'sop-004',
      question: 'Wie scorre ich einen Lead und welche Sequenz bekommt er',
      answer: `Lead-Scoring Kurzanleitung:

Addiere die Punkte:
+ Lead-Quelle: Direkte Anfrage +50 · Empfehlung +40 · Google Ads +15 · Meta Ads +0
+ Produkt: Outdoor London/Crown +30 · Malibu/Sofia +25 · Royal/Emporio +20 · Rainbow/Zara/Rom +15
+ Whirlsystem: Exclusive/Champagner +25 · Deluxe/Excellent +15 · Superior +5
+ Kaufzeitrahmen: Sofort +30 · <4 Wochen +20 · 1-3 Monate +10 · Unklar +0
+ B2B/Hotel: +25 · Rückruf erbeten: +15 · Detailfragen: +10

Ergebnis → Sequenz:
70+ Punkte → 🔥 HEISS → Sequenz A (sofort anrufen + 5 E-Mails/10 Tage)
25–69 Punkte → 🟡 WARM → Sequenz B (Anruf 24h + 3 E-Mails/14 Tage)
<25 Punkte → ❄️ KALT → Sequenz C (8 Wochen Nurture, automatisch)`,
      category: 'SOP',
      keywords: 'score,scoring,punkte,lead,bewerten,sequenz,welche,kategorie,heiß,warm,kalt'
    },
    {
      id: 'sop-005',
      question: 'Was mache ich wenn eine direkte Anfrage reinkommt',
      answer: `Direkte Anfrage = Gold. Sofortiger Ablauf:

① Score berechnen: Direkte Anfrage = bereits 50 Punkte Basis → fast immer Heiß (70+).
② Innerhalb 1 Stunde anrufen (während Geschäftszeiten). Falls nicht erreichbar: Voicemail + E-Mail seq-a1.
③ E-Mail seq-a1 senden (Betreff: "Ihre Anfrage zum [Produkt] – ich melde mich heute noch persönlich").
④ In HubSpot: Lead-Kategorie = Heiß, Sequenz A starten, Anruf-Task für heute.
⑤ Falls Produkt bekannt: Weclapp prüfen – Verfügbarkeit, Lieferzeit notieren für Gespräch.

Merke: 75-80% deiner direkten Anfragen kaufen. Keine einzige darf untergehen.`,
      category: 'SOP',
      keywords: 'direkte anfrage,direkt,anfrage,website,kontaktformular,reaktion,was tun,sofort'
    }
  ]

  for (const e of sopEntries) {
    upsert.run(e.id, e.question, e.answer, e.category, e.keywords, now, now)
  }
  console.log('[Chatbot] SOP knowledge upserted')
}

// Initialize knowledge on startup
seedKnowledge()
upsertSopKnowledge()

// POST /api/chatbot – Ask a question
chatbotRouter.post('/', (req, res) => {
  try {
    const { question, customerId, taskId } = req.body
    if (!question) return res.status(400).json({ error: 'question required' })

    // Get customer context if provided
    let customerContext = ''
    if (customerId) {
      const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId) as any
      if (customer) {
        customerContext = `Kunde: ${customer.name}${customer.company ? ` (${customer.company})` : ''}`
        const tasks = db.prepare("SELECT * FROM tasks WHERE customer_id = ? AND status != 'completed' LIMIT 3").all(customerId) as any[]
        if (tasks.length > 0) {
          customerContext += ` | Offene Aufgaben: ${tasks.map((t: any) => t.title).join(", ")}`
        }
      }
    }

    const result = findBestAnswer(question)

    if (result) {
      res.json({
        answer: result.answer,
        confidence: result.confidence,
        category: result.category,
        customerContext: customerContext || null,
        source: 'knowledge_base'
      })
    } else {
      res.json({
        answer: 'Zu dieser Frage habe ich noch keine Antwort gespeichert. Sie können die Wissensbasis unter Einstellungen → Chatbot trainieren erweitern.',
        confidence: 0,
        category: 'unknown',
        customerContext: customerContext || null,
        source: 'fallback'
      })
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/chatbot/knowledge – List all knowledge entries
chatbotRouter.get('/knowledge', (req, res) => {
  try {
    const entries = db.prepare('SELECT * FROM chatbot_knowledge ORDER BY category, question').all()
    res.json(entries)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// POST /api/chatbot/knowledge – Add a new entry
chatbotRouter.post('/knowledge', (req, res) => {
  try {
    const { question, answer, category = 'general', keywords = '' } = req.body
    if (!question || !answer) return res.status(400).json({ error: 'question and answer required' })

    const id = randomUUID()
    const now = new Date().toISOString()
    db.prepare(`
      INSERT INTO chatbot_knowledge (id, question, answer, category, keywords, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, question, answer, category, keywords, now, now)

    res.status(201).json({ id, question, answer, category, keywords })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// PATCH /api/chatbot/knowledge/:id – Update an entry
chatbotRouter.patch('/knowledge/:id', (req, res) => {
  try {
    const { question, answer, category, keywords } = req.body
    const now = new Date().toISOString()
    const updates: string[] = ['updated_at = ?']
    const params: any[] = [now]
    if (question) { updates.push('question = ?'); params.push(question) }
    if (answer) { updates.push('answer = ?'); params.push(answer) }
    if (category) { updates.push('category = ?'); params.push(category) }
    if (keywords !== undefined) { updates.push('keywords = ?'); params.push(keywords) }
    params.push(req.params.id)

    const result = db.prepare(`UPDATE chatbot_knowledge SET ${updates.join(', ')} WHERE id = ?`).run(...params)
    if (result.changes === 0) return res.status(404).json({ error: 'Not found' })
    res.json({ success: true })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// DELETE /api/chatbot/knowledge/:id – Delete an entry
chatbotRouter.delete('/knowledge/:id', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM chatbot_knowledge WHERE id = ?').run(req.params.id)
    if (result.changes === 0) return res.status(404).json({ error: 'Not found' })
    res.status(204).send()
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})