import { db } from './database.js'
import { randomUUID } from 'crypto'

export function seedDatabase() {
  // Only seed when explicitly requested via env var
  if (process.env.SEED_DATA !== 'true') {
    console.log('Seed skipped (set SEED_DATA=true to enable)')
    return
  }

  // Check if data already exists
  const customerCount = db.prepare('SELECT COUNT(*) as count FROM customers').get() as { count: number }
  if (customerCount.count > 0) {
    console.log('Database already has data, skipping seed')
    return
  }

  console.log('Seeding database with test data...')

  const now = new Date()
  const customers = [
    {
      id: randomUUID(),
      name: 'Thomas Schmidt',
      email: 'schmidt@schmidt-gmbh.de',
      phone: '+49 89 123456',
      company: 'Schmidt GmbH',
      hubspot_id: 'hs-001',
      weclapp_id: 'wc-001'
    },
    {
      id: randomUUID(),
      name: 'Anna Mueller',
      email: 'a.mueller@mueller-ag.de',
      phone: '+49 30 987654',
      company: 'Mueller AG',
      hubspot_id: 'hs-002',
      weclapp_id: 'wc-002'
    },
    {
      id: randomUUID(),
      name: 'Michael Weber',
      email: 'weber@weber-partner.de',
      phone: '+49 40 555123',
      company: 'Weber & Partner',
      hubspot_id: 'hs-003',
      weclapp_id: null
    },
    {
      id: randomUUID(),
      name: 'Sandra Bauer',
      email: 's.bauer@bauer-kg.de',
      phone: '+49 69 111222',
      company: 'Bauer KG',
      hubspot_id: null,
      weclapp_id: 'wc-004'
    },
    {
      id: randomUUID(),
      name: 'Klaus Fischer',
      email: 'fischer@fischer-ohg.de',
      phone: '+49 711 333444',
      company: 'Fischer OHG',
      hubspot_id: 'hs-005',
      weclapp_id: 'wc-005'
    },
    {
      id: randomUUID(),
      name: 'Lisa Hoffmann',
      email: 'hoffmann@technik-hoffmann.de',
      phone: '+49 221 666777',
      company: 'Technik Hoffmann',
      hubspot_id: 'hs-006',
      weclapp_id: 'wc-006'
    }
  ]

  // Insert customers
  const insertCustomer = db.prepare(`
    INSERT INTO customers (id, name, email, phone, company, hubspot_id, weclapp_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  for (const customer of customers) {
    insertCustomer.run(
      customer.id,
      customer.name,
      customer.email,
      customer.phone,
      customer.company,
      customer.hubspot_id,
      customer.weclapp_id,
      now.toISOString(),
      now.toISOString()
    )
  }

  // Create tasks for customers
  const tasks = [
    // Urgent tasks
    {
      id: randomUUID(),
      title: 'Reklamation #4521 - Defektes Produkt',
      description: 'Kunde meldet defektes Gehaeuse bei Lieferung. Ersatzlieferung dringend erforderlich.',
      source: 'hubspot',
      type: 'ticket',
      priority: 'urgent',
      status: 'open',
      customer_id: customers[0].id,
      due_date: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: randomUUID(),
      title: 'Auftrag #8923 - Versand ueberfaellig',
      description: 'Liefertermin wurde nicht eingehalten. Kunde wartet seit 5 Tagen.',
      source: 'weclapp',
      type: 'order',
      priority: 'urgent',
      status: 'open',
      customer_id: customers[1].id,
      due_date: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString()
    },
    // High priority tasks
    {
      id: randomUUID(),
      title: 'Lead Follow-up faellig',
      description: 'Interessent wartet auf Angebot fuer Enterprise-Loesung. Budget: 50.000 EUR',
      source: 'hubspot',
      type: 'lead',
      priority: 'high',
      status: 'open',
      customer_id: customers[2].id,
      due_date: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: randomUUID(),
      title: 'Verpasster Anruf - Rueckruf erforderlich',
      description: 'Kunde hat 3x versucht anzurufen. Dringender Rueckruf notwendig.',
      source: 'aircall',
      type: 'call',
      priority: 'high',
      status: 'open',
      customer_id: customers[3].id,
      due_date: new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString()
    },
    // Normal priority tasks
    {
      id: randomUUID(),
      title: 'Zahlungseingang pruefen - RE-2024-0892',
      description: 'Rechnung ueber 12.500 EUR ist seit 14 Tagen offen.',
      source: 'weclapp',
      type: 'payment',
      priority: 'normal',
      status: 'waiting',
      customer_id: customers[4].id,
      due_date: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: randomUUID(),
      title: 'Neuer Lead - Anfrage Website',
      description: 'Hat Kontaktformular ausgefuellt. Interesse an Produktkatalog.',
      source: 'hubspot',
      type: 'lead',
      priority: 'normal',
      status: 'open',
      customer_id: customers[5].id,
      due_date: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString()
    },
    {
      id: randomUUID(),
      title: 'Auftrag #8950 - Bestaetigung senden',
      description: 'Auftragsbestaetigung per E-Mail versenden.',
      source: 'weclapp',
      type: 'order',
      priority: 'normal',
      status: 'in_progress',
      customer_id: customers[0].id,
      due_date: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString()
    },
    // Low priority / completed tasks
    {
      id: randomUUID(),
      title: 'Kundenfeedback dokumentieren',
      description: 'Positives Feedback zur letzten Lieferung erfassen.',
      source: 'hubspot',
      type: 'ticket',
      priority: 'low',
      status: 'open',
      customer_id: customers[1].id,
      due_date: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: randomUUID(),
      title: 'Reklamation #4498 - Geloest',
      description: 'Ersatzlieferung wurde versandt und vom Kunden bestaetigt.',
      source: 'hubspot',
      type: 'ticket',
      priority: 'high',
      status: 'completed',
      customer_id: customers[3].id,
      due_date: null,
      created_at: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: randomUUID(),
      title: 'Verpasster Anruf - Erledigt',
      description: 'Rueckruf erfolgt, Kunde zufrieden.',
      source: 'aircall',
      type: 'call',
      priority: 'normal',
      status: 'completed',
      customer_id: customers[4].id,
      due_date: null,
      created_at: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString()
    }
  ]

  // Insert tasks
  const insertTask = db.prepare(`
    INSERT INTO tasks (id, title, description, source, type, priority, status, customer_id, due_date, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  for (const task of tasks) {
    insertTask.run(
      task.id,
      task.title,
      task.description,
      task.source,
      task.type,
      task.priority,
      task.status,
      task.customer_id,
      task.due_date,
      task.created_at,
      now.toISOString()
    )
  }

  // Insert activity patterns for automation suggestions
  const patterns = [
    {
      id: randomUUID(),
      pattern_type: 'shipping_confirmation',
      frequency: 12,
      last_occurrence: now.toISOString()
    },
    {
      id: randomUUID(),
      pattern_type: 'payment_reminder',
      frequency: 8,
      last_occurrence: now.toISOString()
    },
    {
      id: randomUUID(),
      pattern_type: 'ticket_response',
      frequency: 15,
      last_occurrence: now.toISOString()
    }
  ]

  const insertPattern = db.prepare(`
    INSERT INTO activity_patterns (id, pattern_type, frequency, last_occurrence, created_at)
    VALUES (?, ?, ?, ?, ?)
  `)

  for (const pattern of patterns) {
    insertPattern.run(
      pattern.id,
      pattern.pattern_type,
      pattern.frequency,
      pattern.last_occurrence,
      now.toISOString()
    )
  }

  console.log(`Seeded: ${customers.length} customers, ${tasks.length} tasks, ${patterns.length} patterns`)
}
