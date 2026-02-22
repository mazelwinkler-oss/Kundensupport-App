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

// Initialize knowledge on startup
seedKnowledge()

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