import Database, { Database as DatabaseType } from 'better-sqlite3'
import path from 'path'

const dbPath = path.join(process.cwd(), 'data/support.db')

export const db: DatabaseType = new Database(dbPath)

export function initDatabase() {
  // Enable foreign keys
  db.pragma('foreign_keys = ON')

  // Create tables
  db.exec(`
    -- Customers table (unified view)
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      company TEXT,
      hubspot_id TEXT,
      weclapp_id TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Tasks table (unified tasks from all sources)
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      source TEXT NOT NULL CHECK (source IN ('hubspot', 'weclapp', 'aircall')),
      type TEXT NOT NULL CHECK (type IN ('lead', 'ticket', 'order', 'call', 'payment')),
      priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('urgent', 'high', 'normal', 'low')),
      status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'waiting', 'completed')),
      customer_id TEXT,
      external_id TEXT,
      due_date TEXT,
      metadata TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    );

    -- Templates table
    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      subject TEXT,
      content TEXT NOT NULL,
      placeholders TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Activity patterns for automation suggestions
    CREATE TABLE IF NOT EXISTS activity_patterns (
      id TEXT PRIMARY KEY,
      pattern_type TEXT NOT NULL,
      frequency INTEGER DEFAULT 1,
      last_occurrence TEXT,
      metadata TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Sync log for tracking API syncs
    CREATE TABLE IF NOT EXISTS sync_log (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      sync_type TEXT NOT NULL,
      status TEXT NOT NULL,
      records_synced INTEGER DEFAULT 0,
      error_message TEXT,
      started_at TEXT DEFAULT CURRENT_TIMESTAMP,
      completed_at TEXT
    );

    -- Users table for auth and roles
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      role TEXT NOT NULL DEFAULT 'support' CHECK (role IN ('admin', 'support')),
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Actions log for audit trail
    CREATE TABLE IF NOT EXISTS actions_log (
      id TEXT PRIMARY KEY,
      actor TEXT NOT NULL,
      action_type TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      payload_hash TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Create indexes
    CREATE INDEX IF NOT EXISTS idx_tasks_source ON tasks(source);
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
    CREATE INDEX IF NOT EXISTS idx_tasks_customer ON tasks(customer_id);
    CREATE INDEX IF NOT EXISTS idx_customers_hubspot ON customers(hubspot_id);
    CREATE INDEX IF NOT EXISTS idx_customers_weclapp ON customers(weclapp_id);
    CREATE INDEX IF NOT EXISTS idx_actions_log_actor ON actions_log(actor);
    CREATE INDEX IF NOT EXISTS idx_actions_log_entity ON actions_log(entity_type, entity_id);
  `)

  // Add new columns to templates table if they don't exist
  try {
    db.exec(`ALTER TABLE templates ADD COLUMN usage_count INTEGER DEFAULT 0`)
  } catch (e) {
    // Column already exists
  }
  try {
    db.exec(`ALTER TABLE templates ADD COLUMN task_types TEXT`)
  } catch (e) {
    // Column already exists
  }
  try {
    db.exec(`ALTER TABLE templates ADD COLUMN keywords TEXT`)
  } catch (e) {
    // Column already exists
  }

  // Insert default templates if none exist
  const templateCount = db.prepare('SELECT COUNT(*) as count FROM templates').get() as { count: number }

  if (templateCount.count === 0) {
    const insertTemplate = db.prepare(`
      INSERT INTO templates (id, name, category, subject, content, placeholders)
      VALUES (?, ?, ?, ?, ?, ?)
    `)

    const defaultTemplates = [
      {
        id: 'tpl-1',
        name: 'Versandbestaetigung',
        category: 'Versand',
        subject: 'Ihre Bestellung {Bestellnummer} wurde versendet',
        content: `Guten Tag {Kundenname},

wir freuen uns, Ihnen mitteilen zu koennen, dass Ihre Bestellung {Bestellnummer} soeben unser Lager verlassen hat.

Voraussichtliches Lieferdatum: {Lieferdatum}
Tracking-Nummer: {Trackingnummer}

Bei Fragen stehen wir Ihnen gerne zur Verfuegung.

Mit freundlichen Gruessen
Ihr Support-Team`,
        placeholders: JSON.stringify(['Kundenname', 'Bestellnummer', 'Lieferdatum', 'Trackingnummer'])
      },
      {
        id: 'tpl-2',
        name: 'Reklamations-Eingangsbestaetigung',
        category: 'Reklamation',
        subject: 'Ihre Reklamation {Ticketnummer} - Wir kuemmern uns darum',
        content: `Guten Tag {Kundenname},

vielen Dank fuer Ihre Nachricht. Wir haben Ihre Reklamation unter der Nummer {Ticketnummer} erfasst.

Beschreibung des Problems:
{Problembeschreibung}

Wir werden uns innerhalb von 24 Stunden bei Ihnen melden.

Mit freundlichen Gruessen
Ihr Support-Team`,
        placeholders: JSON.stringify(['Kundenname', 'Ticketnummer', 'Problembeschreibung'])
      },
      {
        id: 'tpl-3',
        name: 'Zahlungserinnerung',
        category: 'Finanzen',
        subject: 'Freundliche Zahlungserinnerung - Rechnung {Rechnungsnummer}',
        content: `Guten Tag {Kundenname},

bei der Durchsicht unserer Buchhaltung ist uns aufgefallen, dass die Rechnung {Rechnungsnummer} vom {Rechnungsdatum} ueber {Betrag} EUR noch offen ist.

Sollte die Zahlung bereits erfolgt sein, betrachten Sie dieses Schreiben bitte als gegenstandslos.

Mit freundlichen Gruessen
Ihr Support-Team`,
        placeholders: JSON.stringify(['Kundenname', 'Rechnungsnummer', 'Rechnungsdatum', 'Betrag'])
      }
    ]

    for (const template of defaultTemplates) {
      insertTemplate.run(
        template.id,
        template.name,
        template.category,
        template.subject,
        template.content,
        template.placeholders
      )
    }
  }

  console.log('Database initialized successfully')

  // Seed with test data if empty
  import('./seed.js').then(({ seedDatabase }) => {
    seedDatabase()
  }).catch(err => {
    console.error('Failed to seed database:', err)
  })
}
