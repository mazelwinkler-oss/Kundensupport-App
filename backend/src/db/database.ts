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

  // ─── Lead Follow-up Sequence Templates (Black Book, psychologisch optimiert) ───
  // INSERT OR IGNORE: bestehende Templates + usage_count bleiben erhalten
  const insertSeqTemplate = db.prepare(`
    INSERT OR IGNORE INTO templates (id, name, category, subject, content, placeholders, usage_count)
    VALUES (?, ?, ?, ?, ?, ?, 0)
  `)

  const sequenceTemplates = [
    // ── SEQUENZ A – Heiße Leads (Score 70+) ─────────────────────────────────
    {
      id: 'seq-a1',
      name: 'Sequenz A1 – Erstkontakt (Tag 0, 2h nach Lead)',
      category: 'Lead-Sequenz-A',
      subject: 'Ihre Anfrage zum {Produkt} – ich melde mich heute noch persönlich',
      content: `Hallo {Anrede} {Nachname},

vielen Dank für Ihre Anfrage – und gleichzeitig: Herzlichen Glückwunsch.

Mit dem {Produkt} haben Sie sich für einen unserer meistgekauften Whirlpools entschieden – bekannt aus Atrium, Bellevue und Traumbäder, geliebt von hunderten Kunden in Deutschland, Österreich und der Schweiz.

Ich melde mich noch heute persönlich bei Ihnen – telefonisch – um zwei Dinge zu klären:

① Welches Whirlsystem passt wirklich zu Ihnen?
② Wann können wir den Liefertermin fixieren?

Wann sind Sie heute oder morgen kurz erreichbar?

Herzliche Grüße,
{Supportname}
direktvomhersteller.de | SpaVida®
Tel: +49 211 78178315

P.S. Trusted Shop-geprüft mit Käuferschutz bis 20.000 €. Ihre Investition ist zu 100% abgesichert.`,
      placeholders: JSON.stringify(['Anrede', 'Nachname', 'Produkt', 'Supportname'])
    },
    {
      id: 'seq-a2',
      name: 'Sequenz A2 – Wertaufbau Bildsprache (Tag 2)',
      category: 'Lead-Sequenz-A',
      subject: '{Anrede} {Nachname}, stellen Sie sich das vor...',
      content: `Hallo {Anrede} {Nachname},

stellen Sie sich vor: Es ist 20:30 Uhr. Ein langer Tag liegt hinter Ihnen.

Sie lassen warmes Wasser ein. Die Massagedüsen starten – und der Rücken entspannt sich, Schulter für Schulter. Das LED-Licht taucht das Bad in ruhiges Licht. Der Wasserfall plätschert leise. Sie lassen den Tag einfach los.

Das ist kein Urlaub. Das ist Ihr Badezimmer – mit dem {Produkt}.

Was viele erst nach dem Kauf verstehen: Ein SpaVida® ist keine Badewanne. Es ist ein tägliches Ritual, das Ihre Lebensqualität messbar verändert.

Damit Sie das Richtige wählen, kurz die drei beliebtesten Whirlsysteme:

• MultiSpa Deluxe – Wasserfall + Marmorelemente + Pop-up TV. Für die, die Atmosphäre lieben.
• MultiSpa Champagner – Prickelnde Luftmassage + Turbo-Massagesystem. Unser beliebtestes System.
• MultiSpa Exclusive – Das Beste, was wir haben. Für anspruchsvollste Wellness-Liebhaber.

Welches spricht Sie an? Ich berate Sie gerne – ohne Verkaufsdruck, mit echtem Fachwissen.

Herzliche Grüße,
{Supportname}
direktvomhersteller.de | SpaVida®
Tel: +49 211 78178315`,
      placeholders: JSON.stringify(['Anrede', 'Nachname', 'Produkt', 'Supportname'])
    },
    {
      id: 'seq-a3',
      name: 'Sequenz A3 – Social Proof (Tag 5)',
      category: 'Lead-Sequenz-A',
      subject: 'Was andere sagen – und warum das für Sie relevant ist',
      content: `Hallo {Anrede} {Nachname},

manchmal braucht es keine langen Worte. Nur die richtigen:

„Das ging ja sehr fix – nach 2 Tagen war die Wanne schon da. Heute installiert, meine Frau will gar nicht mehr raus aus dem Whirlpool."
– Max Gaida

„Bester Service und sehr gute Verarbeitung – eben deutsche Qualität."
– Jürgen Räffle, Architekt

„Pünktlich wie abgesprochen, ein Tag vor Weihnachten ist unsere Whirlwanne angekommen. Die Überraschung war perfekt. Die Whirlwanne ist ein Traum!"
– Henry Stricker

Drei Menschen, drei verschiedene Whirlpools, ein gemeinsames Ergebnis: Sie würden es sofort wieder tun.

Bekannt aus: Atrium · Bellevue · Traumbäder · Wohnglück · Mein Spa.
Trusted Shop-geprüft. 3 Jahre Garantie. 30 Tage Widerrufsrecht.

Ihr {Produkt} wartet auf Sie.

Soll ich Ihnen ein konkretes Angebot zusammenstellen?

Herzliche Grüße,
{Supportname}
direktvomhersteller.de | SpaVida®
Tel: +49 211 78178315`,
      placeholders: JSON.stringify(['Anrede', 'Nachname', 'Produkt', 'Supportname'])
    },
    {
      id: 'seq-a4',
      name: 'Sequenz A4 – 5-Schritte-Ablauf (Tag 7)',
      category: 'Lead-Sequenz-A',
      subject: 'So läuft Ihre Bestellung – in 5 Schritten',
      content: `Hallo {Anrede} {Nachname},

ich möchte Ihnen zeigen, was nach Ihrer Entscheidung passiert – damit Sie genau wissen, womit Sie rechnen können:

① Persönliche Beratung (15 Minuten)
   Wir klären gemeinsam: Maße, Whirlsystem, Liefertermin.

② Bestellung & Auftragsbestätigung
   Sie erhalten sofort eine schriftliche Bestätigung.

③ Fertigung & Qualitätsprüfung
   Jeder SpaVida® wird vor dem Versand geprüft.

④ Lieferung frei Haus (DE, AT, CH)
   Speditionslieferung, Zeitfenster nach Absprache.

⑤ Genießen.
   Deutschlandweiter Kundendienst – für alles, was danach kommt.

Ihr nächster Schritt: Ein kurzes Telefonat – 15 Minuten genügen.

Wann passt es Ihnen diese Woche?

Herzliche Grüße,
{Supportname}
direktvomhersteller.de | SpaVida®
Tel: +49 211 78178315`,
      placeholders: JSON.stringify(['Anrede', 'Nachname', 'Supportname'])
    },
    {
      id: 'seq-a5',
      name: 'Sequenz A5 – Abschluss mit Verlustaversion (Tag 10)',
      category: 'Lead-Sequenz-A',
      subject: 'Letzte Nachricht – und ein konkreter Hinweis zu {Produkt}',
      content: `Hallo {Anrede} {Nachname},

dies ist meine letzte Nachricht zu Ihrer Anfrage – ich möchte Ihnen nichts aufzwingen.

Nur ein ehrlicher Hinweis: Der {Produkt} ist aktuell noch zum Vorteilspreis von {Preis} € verfügbar – das sind {Ersparnis} € unter dem regulären Handelspreis. Preise können sich jederzeit ändern.

Falls Sie noch Fragen haben, beantworte ich diese gerne – per E-Mail oder Telefon, ohne Druck, ohne Verkaufsgespräch. Nur echte Antworten.

Und falls Ihr Timing sich einfach verschoben hat: kein Problem. Schreiben Sie mir, wenn Sie bereit sind – ich bin da.

Tel: +49 211 78178315
winkler@direktvomhersteller.de

Herzliche Grüße,
{Supportname}
direktvomhersteller.de | SpaVida®`,
      placeholders: JSON.stringify(['Anrede', 'Nachname', 'Produkt', 'Preis', 'Ersparnis', 'Supportname'])
    },

    // ── SEQUENZ B – Warme Leads (Score 25–69) ────────────────────────────────
    {
      id: 'seq-b1',
      name: 'Sequenz B1 – Persönlicher Ratgeber (Tag 1)',
      category: 'Lead-Sequenz-B',
      subject: '{Anrede} {Nachname}, Ihr persönlicher Whirlpool-Ratgeber',
      content: `Hallo {Anrede} {Nachname},

schön, dass Sie sich für einen SpaVida® Whirlpool interessieren.

Eine Entscheidung dieser Größe verdient mehr als einen schnellen Online-Klick. Deshalb begleite ich Sie persönlich – von der ersten Frage bis zur Lieferung.

Drei Dinge, die unsere Kunden vorab wissen möchten:

① Direkt vom Hersteller – bis zu 50% günstiger als im Handel.
   Kein Zwischenhändler. Kein versteckter Aufschlag.

② Trusted Shop-Käuferschutz bis 20.000 € + 3 Jahre Garantie + 30 Tage Widerrufsrecht.
   Ihre Investition ist vollständig abgesichert.

③ Persönliche Beratung vor dem Kauf – ich finde mit Ihnen gemeinsam den Whirlpool,
   der wirklich zu Ihnen passt. Kostenlos, unverbindlich.

Haben Sie bereits ein konkretes Modell im Blick – oder sollen wir gemeinsam starten?

Herzliche Grüße,
{Supportname}
direktvomhersteller.de | SpaVida®
Tel: +49 211 78178315`,
      placeholders: JSON.stringify(['Anrede', 'Nachname', 'Supportname'])
    },
    {
      id: 'seq-b2',
      name: 'Sequenz B2 – FAQ Einwandbehandlung (Tag 6)',
      category: 'Lead-Sequenz-B',
      subject: 'Die 5 Fragen, die unsere Kunden immer stellen',
      content: `Hallo {Anrede} {Nachname},

aus hunderten Beratungsgesprächen weiß ich: Es gibt fünf Fragen, die fast jeder stellt. Hier sind die ehrlichen Antworten:

Wie wird geliefert?
Per Spedition, frei Haus, nach Terminabsprache (DE, AT, CH).
Lieferzeiten: 3–4 Wochen (Standardmodelle), bis 16 Wochen (Outdoor/Sonder).

Wie wird der Whirlpool eingebaut?
Wie jede normale Badewanne – durch Ihren Sanitär-Fachbetrieb.
Alle technischen Unterlagen liefern wir mit.

Was ist, wenn etwas nicht stimmt?
3 Jahre Garantie, deutschlandweiter Kundendienst.
Reklamationen bearbeiten wir innerhalb von 24–48 Stunden persönlich.

Kann ich zurückgeben?
Ja – 30 Tage Widerrufsrecht. Kein Wenn und Aber.

Lohnt sich der Preisunterschied?
Bei einem {Produkt} sparen Sie {Ersparnis} € gegenüber dem Fachhandel.
Bei gleicher Qualität, gleicher Garantie – einfach direkter.

Gibt es noch etwas, das Sie wissen möchten? Ich antworte noch heute.

Herzliche Grüße,
{Supportname}
direktvomhersteller.de | SpaVida®
Tel: +49 211 78178315`,
      placeholders: JSON.stringify(['Anrede', 'Nachname', 'Produkt', 'Ersparnis', 'Supportname'])
    },
    {
      id: 'seq-b3',
      name: 'Sequenz B3 – Persönliche Empfehlung POA (Tag 14)',
      category: 'Lead-Sequenz-B',
      subject: 'Meine persönliche Empfehlung für Sie, {Anrede} {Nachname}',
      content: `Hallo {Anrede} {Nachname},

basierend auf Ihrer Anfrage möchte ich Ihnen heute eine persönliche Empfehlung machen – keine Standard-Preisliste, sondern genau das, was für Sie Sinn ergibt.

Meine Empfehlung: {Produkt} mit {Whirlsystem}

Warum genau dieses Modell:
{IndividuelleBegründung}

Ihre Investition: {Preis} €
Das sind {Ersparnis} € unter dem Handelspreis – bei identischer Qualität, 3 Jahren Garantie und direktem Hersteller-Service.

Nächster Schritt: Ein kurzes Telefonat (15 Min.) – dann klären wir alles und fixieren Ihren Liefertermin.

Wann passt es Ihnen?

Herzliche Grüße,
{Supportname}
direktvomhersteller.de | SpaVida®
Tel: +49 211 78178315`,
      placeholders: JSON.stringify(['Anrede', 'Nachname', 'Produkt', 'Whirlsystem', 'IndividuelleBegründung', 'Preis', 'Ersparnis', 'Supportname'])
    },

    // ── SEQUENZ C – Kalte Meta-Leads (Score <25, 8 Wochen Nurture) ───────────
    {
      id: 'seq-c1',
      name: 'Sequenz C1 – Willkommen (Woche 1)',
      category: 'Lead-Nurture-C',
      subject: 'Ihr SpaVida® Whirlpool-Erlebnis beginnt hier',
      content: `Hallo {Anrede} {Nachname},

schön, dass Sie auf uns aufmerksam geworden sind.

SpaVida® steht für eines: Luxus-Wellness direkt vom Hersteller – ohne Händleraufschlag, mit persönlicher Beratung, für Menschen, die wissen, was sie sich verdient haben.

In den nächsten Wochen erhalten Sie von mir kompakte Einblicke: Modelle, Systeme, Erfahrungsberichte und ehrliche Beratungstipps. Alles, was Sie für eine gute Entscheidung brauchen.

Keine Eile. Kein Druck.

Falls Sie bereits eine konkrete Frage haben – schreiben Sie einfach zurück.

Herzliche Grüße,
{Supportname}
direktvomhersteller.de | SpaVida®
Tel: +49 211 78178315`,
      placeholders: JSON.stringify(['Anrede', 'Nachname', 'Supportname'])
    },
    {
      id: 'seq-c2',
      name: 'Sequenz C2 – Kaufratgeber (Woche 2)',
      category: 'Lead-Nurture-C',
      subject: 'Whirlpool kaufen – worauf kommt es wirklich an?',
      content: `Hallo {Anrede} {Nachname},

die meisten Menschen beschäftigen sich wochenlang mit den falschen Fragen. Ich spare Ihnen diese Zeit.

Drei Fragen entscheiden alles:

① Wo soll der Whirlpool stehen?
   Badezimmer → Indoor-Whirlpool-Badewanne.
   Garten/Terrasse → Outdoor-Whirlpool.

② Wie viele Personen nutzen ihn regelmäßig?
   1–2 Personen → 180–185cm Modelle. Familie → großzügiger planen.

③ Was ist Ihnen wichtiger: Massage oder Atmosphäre?
   Massage → Champagner-System mit Turbo-Düsen.
   Atmosphäre → Deluxe mit Wasserfall, Marmorelemente und TV.

Mit diesen drei Antworten finden wir in 10 Minuten Ihren Traumwhirlpool.

Herzliche Grüße,
{Supportname}
direktvomhersteller.de | SpaVida®
Tel: +49 211 78178315`,
      placeholders: JSON.stringify(['Anrede', 'Nachname', 'Supportname'])
    },
    {
      id: 'seq-c3',
      name: 'Sequenz C3 – Kundenstory Henry Stricker (Woche 3)',
      category: 'Lead-Nurture-C',
      subject: '„Ein Tag vor Weihnachten kam die Wanne an – die Überraschung war perfekt."',
      content: `Hallo {Anrede} {Nachname},

Henry Stricker hatte einen klaren Plan: kein Gadget, kein Gutschein – etwas Echtes für seine Familie zu Weihnachten.

Pünktlich wie abgesprochen, ein Tag vor Heiligabend, wurde der SpaVida® Whirlpool geliefert.

„Die Whirlwanne ist ein Traum", schrieb er uns.

Was Henry wusste: Ein Whirlpool ist keine Ausgabe. Es ist eine Investition in Momente – täglich, jahrelang.

Welchen Moment möchten Sie sich schenken?

Herzliche Grüße,
{Supportname}
direktvomhersteller.de | SpaVida®
Tel: +49 211 78178315`,
      placeholders: JSON.stringify(['Anrede', 'Nachname', 'Supportname'])
    },
    {
      id: 'seq-c4',
      name: 'Sequenz C4 – Bestseller Royal Spotlight (Woche 4)',
      category: 'Lead-Nurture-C',
      subject: 'Warum dieser Whirlpool Woche für Woche am häufigsten bestellt wird',
      content: `Hallo {Anrede} {Nachname},

der SpaVida® Royal (Deluxe) ist unser Kundenliebling. Woche für Woche.

180×120cm · 2 Personen · MultiSpa Deluxe-System
Marmorelemente · Wasserfall · Pop-up TV · Sanitäracryl · 3 Jahre Garantie

Regulärer Handelspreis: 7.299 €
Ihre Investition direkt vom Hersteller: 4.499 €

Das ist keine Aktion. Das ist der dauerhafte Vorteil des Direktkaufs.

„Meine Frau will gar nicht mehr raus aus dem Whirlpool."
– Max Gaida, Kunde

Interesse? Ich beantworte gerne Ihre Fragen.

Herzliche Grüße,
{Supportname}
direktvomhersteller.de | SpaVida®
Tel: +49 211 78178315`,
      placeholders: JSON.stringify(['Anrede', 'Nachname', 'Supportname'])
    },
    {
      id: 'seq-c5',
      name: 'Sequenz C5 – Preiswahrheit (Woche 5)',
      category: 'Lead-Nurture-C',
      subject: 'Was kostet ein Whirlpool wirklich – die ehrliche Antwort',
      content: `Hallo {Anrede} {Nachname},

„Whirlpool" – und viele denken sofort: „Das kann ich mir nicht leisten."

Die Wahrheit: Unsere meistgekauften Modelle starten ab 3.799 €.

Auf 5 Jahre gerechnet: Weniger als 2,10 € pro Tag – für echte Entspannung im eigenen Zuhause, täglich verfügbar.

Was Sie dafür bekommen:
→ Direkt vom Hersteller, bis zu 50% unter Handelspreis
→ Trusted Shop-Käuferschutz bis 20.000 €
→ 3 Jahre Garantie, 30 Tage Widerrufsrecht
→ Lieferung frei Haus (DE, AT, CH)

Welches Budget haben Sie im Kopf? Ich finde garantiert das passende Modell.

Herzliche Grüße,
{Supportname}
direktvomhersteller.de | SpaVida®
Tel: +49 211 78178315`,
      placeholders: JSON.stringify(['Anrede', 'Nachname', 'Supportname'])
    },
    {
      id: 'seq-c6',
      name: 'Sequenz C6 – Neuheit Rimini 2024 (Woche 6)',
      category: 'Lead-Nurture-C',
      subject: 'Neu 2024: Rimini – unser schönstes Modell zum Einführungspreis',
      content: `Hallo {Anrede} {Nachname},

unser neuestes Modell ist da: die Whirlpool-Badewanne Rimini (Deluxe) – für 2 Personen, mit dem vollen Deluxe-System.

Als Neuheit ist die Rimini aktuell zum Einführungspreis erhältlich – bevor sie dauerhaft ins Standardsortiment übergeht.

Falls Sie noch am Abwägen sind: Das ist Ihr Zeitfenster. Neuheit + Einführungspreis – eine Kombination, die nicht lange besteht.

Ich schicke Ihnen gerne alle Details, Maße und Fotos.

Herzliche Grüße,
{Supportname}
direktvomhersteller.de | SpaVida®
Tel: +49 211 78178315`,
      placeholders: JSON.stringify(['Anrede', 'Nachname', 'Supportname'])
    },
    {
      id: 'seq-c7',
      name: 'Sequenz C7 – Indoor vs. Outdoor (Woche 7)',
      category: 'Lead-Nurture-C',
      subject: 'Indoor oder Outdoor – die Entscheidungshilfe',
      content: `Hallo {Anrede} {Nachname},

eine Frage, die fast jeder irgendwann stellt: Indoor oder Outdoor?

Indoor-Whirlpool-Badewanne:
→ Täglich nutzbar, unabhängig vom Wetter
→ Ab 3.799 €, kein Fundament nötig
→ Installation wie normale Badewanne
→ Für Wellness nach jedem Arbeitstag

Outdoor-Whirlpool:
→ Das Erlebnis unter freiem Himmel
→ Ab 7.990 € (Malibu) bis 12.490 € (London)
→ Ganzjährig nutzbar, energiesparendes Eco-System
→ Für Sommerabende und Wintermomente

„Sensationelle Abwicklung! Kundenorientierung wird groß geschrieben."
– Andreas Köhler, Outdoor-Kunde

Womit träumen Sie?

Herzliche Grüße,
{Supportname}
direktvomhersteller.de | SpaVida®
Tel: +49 211 78178315`,
      placeholders: JSON.stringify(['Anrede', 'Nachname', 'Supportname'])
    },
    {
      id: 'seq-c8',
      name: 'Sequenz C8 – Persönliche Einladung Abschluss (Woche 8)',
      category: 'Lead-Nurture-C',
      subject: '{Anrede} {Nachname}, eine persönliche Einladung',
      content: `Hallo {Anrede} {Nachname},

in den letzten Wochen habe ich Ihnen einiges über SpaVida® erzählt – über Modelle, Systeme, Preise, Kunden.

Jetzt möchte ich Ihnen etwas anderes anbieten: ein persönliches Gespräch.

15 Minuten, kein Druck, keine Verpflichtung.

Sie schildern mir Ihre Vorstellung – ich sage Ihnen ehrlich, was passt und was nicht. Danach entscheiden Sie in Ruhe.

So einfach ist das.

Tel: +49 211 78178315
Montag – Freitag · 08:00 – 17:00 Uhr

Oder schreiben Sie mir einfach zurück – ich melde mich noch heute.

Herzliche Grüße,
{Supportname}
direktvomhersteller.de | SpaVida®

P.S. Falls der Zeitpunkt noch nicht passt – kein Problem. Ich bin da, wenn Sie bereit sind.`,
      placeholders: JSON.stringify(['Anrede', 'Nachname', 'Supportname'])
    }
  ]

  for (const t of sequenceTemplates) {
    insertSeqTemplate.run(t.id, t.name, t.category, t.subject, t.content, t.placeholders)
  }

  // ─── Ticket & Reklamations-Templates (SLA-priorisiert, Black Book) ────────
  const ticketTemplates = [
    {
      id: 'tkt-1',
      name: 'Ticket: Reklamation – Schaden bei Lieferung',
      category: 'Reklamation',
      subject: 'Wir kümmern uns persönlich – Ticket {Ticketnummer}',
      content: `Hallo {Anrede} {Nachname},

das tut mir aufrichtig leid – das entspricht nicht dem Standard, den wir Ihnen versprochen haben.

Ich übernehme das persönlich. Sie müssen sich um nichts kümmern.

Was jetzt passiert:
① Schicken Sie mir bitte 2–3 Fotos des Schadens per E-Mail.
② Ich prüfe das sofort und melde mich innerhalb von 24 Stunden mit einer konkreten Lösung.

Ob Ersatzteil, Austausch oder Rückgabe – wir finden die beste Lösung für Sie. Das ist unser Versprechen, das ist unsere Garantie.

Meine direkte E-Mail: {SupportEmail}
Tel: +49 211 78178315

Herzliche Grüße,
{Supportname}
direktvomhersteller.de | SpaVida®

Ticketnummer: {Ticketnummer}`,
      placeholders: JSON.stringify(['Anrede', 'Nachname', 'Ticketnummer', 'SupportEmail', 'Supportname'])
    },
    {
      id: 'tkt-2',
      name: 'Ticket: Lieferstatus-Anfrage',
      category: 'Lieferstatus',
      subject: 'Ihre Bestellung {Bestellnummer} – aktueller Status',
      content: `Hallo {Anrede} {Nachname},

ich freue mich, dass Ihr {Produkt} bald bei Ihnen einzieht – hier ist der aktuelle Stand:

Status: {Lieferstatus}
Voraussichtliche Lieferung: {Lieferdatum}
{TrackingInfo}

Die Spedition meldet sich ca. 1–2 Tage vorher bei Ihnen, um ein genaues Zeitfenster zu vereinbaren.

Falls Sie einen bestimmten Wunschtermin haben – melden Sie sich kurz, ich koordiniere das gerne für Sie.

Herzliche Grüße,
{Supportname}
direktvomhersteller.de | SpaVida®
Tel: +49 211 78178315`,
      placeholders: JSON.stringify(['Anrede', 'Nachname', 'Produkt', 'Bestellnummer', 'Lieferstatus', 'Lieferdatum', 'TrackingInfo', 'Supportname'])
    },
    {
      id: 'tkt-3',
      name: 'Ticket: Produktfrage kaufnah (Umsatz-kritisch – 4h SLA!)',
      category: 'Produktberatung',
      subject: 'Meine Empfehlung für Sie, {Anrede} {Nachname}',
      content: `Hallo {Anrede} {Nachname},

vielen Dank für Ihre Frage – genau dafür bin ich da.

Basierend auf dem, was Sie beschreiben, ist meine ehrliche Empfehlung: {Empfehlung}

Warum: {Begründung}

Eine Sache ist mir wichtig: Ich möchte, dass Sie das Modell kaufen, das wirklich zu Ihnen passt – nicht das teuerste oder meistbestellte. Deshalb beantworte ich Ihre Fragen lieber einmal zu viel als zu wenig.

Am schnellsten kommen wir in einem kurzen Telefonat weiter – 15 Minuten, kein Druck. Passt Ihnen heute noch ein Zeitfenster?

Tel: +49 211 78178315

Herzliche Grüße,
{Supportname}
direktvomhersteller.de | SpaVida®`,
      placeholders: JSON.stringify(['Anrede', 'Nachname', 'Empfehlung', 'Begründung', 'Supportname'])
    },
    {
      id: 'tkt-4',
      name: 'Ticket: Installationsfrage',
      category: 'Installation',
      subject: 'Antwort auf Ihre Installationsfrage – {Anrede} {Nachname}',
      content: `Hallo {Anrede} {Nachname},

gute Nachricht: Die Installation Ihres SpaVida® ist einfacher, als die meisten erwarten.

Ihr Whirlpool wird genau wie eine normale Badewanne angeschlossen – durch jeden Sanitär-Fachbetrieb. Spezialwissen ist nicht nötig.

Was Sie brauchen:
→ Standard-Wasseranschluss (Warm + Kalt)
→ Steckdose 230V in der Nähe (für die Pumpensteuerung)
→ Ablauf wie bei einer normalen Badewanne

Zu Ihrer konkreten Frage: {AntwortAufKonkreteFrage}

Alle technischen Maße und Anschluss-Pläne liegen Ihrem Whirlpool bei. Falls Ihr Installateur Fragen hat – er kann sich auch direkt bei uns melden.

Noch etwas unklar? Melden Sie sich gerne.

Herzliche Grüße,
{Supportname}
direktvomhersteller.de | SpaVida®
Tel: +49 211 78178315`,
      placeholders: JSON.stringify(['Anrede', 'Nachname', 'AntwortAufKonkreteFrage', 'Supportname'])
    },
    {
      id: 'tkt-5',
      name: 'Ticket: Technischer Defekt nach Inbetriebnahme',
      category: 'Reklamation',
      subject: 'Wir lösen das – Ticket {Ticketnummer}',
      content: `Hallo {Anrede} {Nachname},

ich verstehe, wie enttäuschend das ist – und ich übernehme das sofort persönlich.

Sie haben in einen hochwertigen Whirlpool investiert. Das soll funktionieren. Punkt.

Um das Problem schnell zu lösen, brauche ich kurz Ihre Hilfe:

① Was genau passiert? (oder was passiert nicht?)
② Seit wann tritt das Problem auf?
③ Wenn möglich: kurzes Video oder Foto

Schicken Sie mir das an: {SupportEmail}

Ich melde mich innerhalb von 24 Stunden mit einer konkreten Lösung – Ersatzteil, Techniker oder Austausch. Ihre 3-Jahres-Garantie deckt das.

Sie können sich entspannt zurücklehnen – wir übernehmen das.

Herzliche Grüße,
{Supportname}
direktvomhersteller.de | SpaVida®
Tel: +49 211 78178315

Ticketnummer: {Ticketnummer}`,
      placeholders: JSON.stringify(['Anrede', 'Nachname', 'Ticketnummer', 'SupportEmail', 'Supportname'])
    }
  ]

  for (const t of ticketTemplates) {
    insertSeqTemplate.run(t.id, t.name, t.category, t.subject, t.content, t.placeholders)
  }

  console.log('Database initialized successfully')

  // Seed with test data if empty
  import('./seed.js').then(({ seedDatabase }) => {
    seedDatabase()
  }).catch(err => {
    console.error('Failed to seed database:', err)
  })
}
