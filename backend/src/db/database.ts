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

    -- Emails sent from the app (for history + Weclapp sync)
    CREATE TABLE IF NOT EXISTS emails (
      id TEXT PRIMARY KEY,
      customer_id TEXT,
      direction TEXT NOT NULL DEFAULT 'outbound',
      subject TEXT,
      body TEXT NOT NULL,
      recipient_email TEXT,
      sent_at TEXT DEFAULT CURRENT_TIMESTAMP,
      weclapp_synced INTEGER DEFAULT 0,
      template_id TEXT,
      task_id TEXT,
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    );

    -- Chatbot knowledge base (trainable Q&A pairs)
    CREATE TABLE IF NOT EXISTS chatbot_knowledge (
      id TEXT PRIMARY KEY,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      category TEXT DEFAULT 'general',
      keywords TEXT,
      use_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
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

    // Templates follow Black Book principles:
    // - Personal greeting: "Hallo Herr/Frau {Nachname}" (never "Sehr geehrte/r")
    // - Clear, benefit-focused language
    // - No weak phrases ("Wir schauen mal", "eventuell")
    // - Short & direct
    const defaultTemplates = [
      {
        id: 'tpl-1',
        name: 'Versandbestaetigung',
        category: 'Versand',
        subject: 'Ihre Bestellung {Bestellnummer} ist unterwegs',
        content: `Hallo {Anrede} {Nachname},

Ihre Bestellung ist unterwegs – Sie bekommen Ihr Paket am {Lieferdatum}.

Bestellnummer: {Bestellnummer}
Tracking: {Trackingnummer}

Bei Fragen bin ich direkt fuer Sie erreichbar.

Viele Gruesse
{Supportname}
direktvomhersteller.de`,
        placeholders: JSON.stringify(['Anrede', 'Nachname', 'Bestellnummer', 'Lieferdatum', 'Trackingnummer', 'Supportname'])
      },
      {
        id: 'tpl-2',
        name: 'Reklamation – Eingang bestaetigt',
        category: 'Reklamation',
        subject: 'Wir kuemmern uns – Reklamation {Ticketnummer}',
        content: `Hallo {Anrede} {Nachname},

wir haben Ihr Anliegen erhalten und kuemmern uns darum.

Ticketnummer: {Ticketnummer}
Thema: {Problembeschreibung}

Sie bekommen innerhalb von 24 Stunden eine Rueckmeldung von mir.

Viele Gruesse
{Supportname}
direktvomhersteller.de`,
        placeholders: JSON.stringify(['Anrede', 'Nachname', 'Ticketnummer', 'Problembeschreibung', 'Supportname'])
      },
      {
        id: 'tpl-3',
        name: 'Zahlungserinnerung',
        category: 'Finanzen',
        subject: 'Offene Rechnung {Rechnungsnummer} – kurze Erinnerung',
        content: `Hallo {Anrede} {Nachname},

Rechnung {Rechnungsnummer} vom {Rechnungsdatum} ueber {Betrag} EUR ist noch offen.

Falls die Zahlung bereits unterwegs ist – alles gut, dann koennen Sie diese Nachricht ignorieren.

Bei Rueckfragen bin ich direkt fuer Sie da.

Viele Gruesse
{Supportname}
direktvomhersteller.de`,
        placeholders: JSON.stringify(['Anrede', 'Nachname', 'Rechnungsnummer', 'Rechnungsdatum', 'Betrag', 'Supportname'])
      },
      {
        id: 'tpl-4',
        name: 'Lieferverzoegerung',
        category: 'Versand',
        subject: 'Kurze Info zu Ihrer Bestellung {Bestellnummer}',
        content: `Hallo {Anrede} {Nachname},

ich moechte Sie kurz informieren: Ihre Bestellung {Bestellnummer} verzoegert sich leider um {Verzoegerung}.

Das neue voraussichtliche Lieferdatum: {NeuesLieferdatum}

Wir arbeiten daran, dass Sie Ihr Produkt so schnell wie moeglich bekommen. Sie hoeren naechstens von mir.

Viele Gruesse
{Supportname}
direktvomhersteller.de`,
        placeholders: JSON.stringify(['Anrede', 'Nachname', 'Bestellnummer', 'Verzoegerung', 'NeuesLieferdatum', 'Supportname'])
      },
      {
        id: 'tpl-5',
        name: 'Auftragsbestaetigung',
        category: 'Auftrag',
        subject: 'Ihre Bestellung {Bestellnummer} ist eingegangen',
        content: `Hallo {Anrede} {Nachname},

Ihre Bestellung ist bei uns eingegangen – wir kuemmern uns darum.

Bestellnummer: {Bestellnummer}
Produkt: {Produktname}
Lieferzeit: {Lieferzeit}

Sie bekommen eine separate Benachrichtigung sobald Ihr Paket verschickt wird.

Viele Gruesse
{Supportname}
direktvomhersteller.de`,
        placeholders: JSON.stringify(['Anrede', 'Nachname', 'Bestellnummer', 'Produktname', 'Lieferzeit', 'Supportname'])
      },
      {
        id: 'tpl-6',
        name: 'Technische Frage beantworten',
        category: 'Produktinfo',
        subject: 'Antwort auf Ihre Anfrage',
        content: `Hallo {Anrede} {Nachname},

vielen Dank fuer Ihre Frage.

{Antwort}

Falls noch etwas unklar ist – melden Sie sich gerne direkt bei mir.

Viele Gruesse
{Supportname}
direktvomhersteller.de`,
        placeholders: JSON.stringify(['Anrede', 'Nachname', 'Antwort', 'Supportname'])
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
  } else {
    // Update existing templates to Black Book versions (upsert by id)
    const upsertTemplate = db.prepare(`
      INSERT OR REPLACE INTO templates (id, name, category, subject, content, placeholders, usage_count)
      VALUES (?, ?, ?, ?, ?, ?, COALESCE((SELECT usage_count FROM templates WHERE id = ?), 0))
    `)
    const blackBookTemplates = [
      {
        id: 'tpl-1',
        name: 'Versandbestaetigung',
        category: 'Versand',
        subject: 'Ihre Bestellung {Bestellnummer} ist unterwegs',
        content: `Hallo {Anrede} {Nachname},\n\nIhre Bestellung ist unterwegs – Sie bekommen Ihr Paket am {Lieferdatum}.\n\nBestellnummer: {Bestellnummer}\nTracking: {Trackingnummer}\n\nBei Fragen bin ich direkt fuer Sie erreichbar.\n\nViele Gruesse\n{Supportname}\ndirektVomHersteller.de`,
        placeholders: JSON.stringify(['Anrede', 'Nachname', 'Bestellnummer', 'Lieferdatum', 'Trackingnummer', 'Supportname'])
      },
      {
        id: 'tpl-2',
        name: 'Reklamation – Eingang bestaetigt',
        category: 'Reklamation',
        subject: 'Wir kuemmern uns – Reklamation {Ticketnummer}',
        content: `Hallo {Anrede} {Nachname},\n\nwir haben Ihr Anliegen erhalten und kuemmern uns darum.\n\nTicketnummer: {Ticketnummer}\nThema: {Problembeschreibung}\n\nSie bekommen innerhalb von 24 Stunden eine Rueckmeldung von mir.\n\nViele Gruesse\n{Supportname}\ndirektVomHersteller.de`,
        placeholders: JSON.stringify(['Anrede', 'Nachname', 'Ticketnummer', 'Problembeschreibung', 'Supportname'])
      },
      {
        id: 'tpl-3',
        name: 'Zahlungserinnerung',
        category: 'Finanzen',
        subject: 'Offene Rechnung {Rechnungsnummer} – kurze Erinnerung',
        content: `Hallo {Anrede} {Nachname},\n\nRechnung {Rechnungsnummer} vom {Rechnungsdatum} ueber {Betrag} EUR ist noch offen.\n\nFalls die Zahlung bereits unterwegs ist – alles gut, dann koennen Sie diese Nachricht ignorieren.\n\nBei Rueckfragen bin ich direkt fuer Sie da.\n\nViele Gruesse\n{Supportname}\ndirektVomHersteller.de`,
        placeholders: JSON.stringify(['Anrede', 'Nachname', 'Rechnungsnummer', 'Rechnungsdatum', 'Betrag', 'Supportname'])
      }
    ]
    for (const t of blackBookTemplates) {
      upsertTemplate.run(t.id, t.name, t.category, t.subject, t.content, t.placeholders, t.id)
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
