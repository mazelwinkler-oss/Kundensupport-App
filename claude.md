# Kundensupport-Automatisierung – Projektdokumentation

## Zweck
Digitaler Assistent für One-Man-Kundensupport bei **direktvomhersteller.de** (Marcel Winkler).
Kein reines Anzeige-Tool – die App soll wie ein echter Assistent arbeiten:
- Echte Weclapp-Daten (keine Testdaten)
- Vollen Kontext zu jeder Aufgabe (Kundenhistorie, Auftrag, letzte E-Mails)
- E-Mails direkt aus der App schreiben und senden (automatisch in Weclapp gespeichert)
- Automatisierbare Muster erkennen und fertige n8n/Claude-Prompts generieren
- Produkt-Chatbot für direktvomhersteller.de (SpaVida® Whirlpools), trainierbar
- Posteingang (Gmail) direkt in der App

**GitHub:** https://github.com/mazelwinkler-oss/Kundensupport-App.git (Branch: master)

---

## Tech Stack
- **Backend:** Node.js, TypeScript, Express, SQLite (better-sqlite3), Port 3001
- **Frontend:** React 19, TypeScript, TailwindCSS v4, Vite 7, lucide-react
- **Integrationen:** Weclapp ERP API, Gmail API (OAuth2), Microsoft Graph API (Fallback)
- **Automatisierung:** n8n Workflows (Prompt-Generierung in der App)

---

## App starten
```bash
# Backend starten (Port 3001)
cd backend && npm run dev

# Frontend starten (Port 5173)
cd frontend && npm run dev
```
Vite proxy leitet `/api` → `http://localhost:3001` weiter (in `frontend/vite.config.ts`).

---

## Umgebungsvariablen (`backend/.env`)
```env
PORT=3001
WECLAPP_TENANT=hixuvzwshzpqhhd
WECLAPP_API_TOKEN=<echter Token aus Weclapp>
SEED_DATA=false                  # true = Testdaten laden, false = nur echte Weclapp-Daten

# Gmail OAuth2 (Posteingang + E-Mail senden)
# Einmalige Einrichtung: npx tsx src/setup-gmail-oauth.ts
GOOGLE_CLIENT_ID=<oauth2-client-id aus Google Cloud Console>
GOOGLE_CLIENT_SECRET=<oauth2-client-secret>
GMAIL_REFRESH_TOKEN=<nach setup-gmail-oauth.ts ausführen>
GMAIL_USER_EMAIL=mail@direktvomhersteller.de

# Microsoft 365 / Outlook (Optional – Fallback wenn Gmail nicht konfiguriert)
MICROSOFT_TENANT_ID=...
MICROSOFT_CLIENT_ID=...
MICROSOFT_CLIENT_SECRET=...
MICROSOFT_SENDER_EMAIL=support@direktvomhersteller.de
```

### Gmail OAuth2 einrichten (einmalig)
1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → OAuth 2.0-Client-ID erstellen
   - Typ: **Webanwendung**
   - Authorized Redirect URI: `http://localhost:3000/oauth2callback`
2. `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` in `.env` eintragen
3. Im `backend/` Ordner ausführen:
   ```bash
   npx tsx src/setup-gmail-oauth.ts
   ```
   → Browser öffnet sich → mit `mail@direktvomhersteller.de` anmelden → Refresh Token kopieren
4. `GMAIL_REFRESH_TOKEN=<token>` in `.env` eintragen → Backend neu starten

---

## Kommunikations-Regeln (IMMER anwenden!)

### Black Book – 8 Skills von Sebastian Fröder
Alle E-Mail-Vorlagen und KI-generierten Texte folgen diesen Prinzipien:
- **Skill 1:** Kurz, klar, max. 3 Kernaussagen – keine langen Erklärungen
- **Skill 3:** Klare Sprache ohne Weichmacher ("Wir übernehmen das" – NICHT "Wir schauen mal")
- **Skill 5:** Nutzen vor Eigenschaften ("Sie haben Planungssicherheit" – nicht technische Details)
- **Skill 8:** Besserer Zustand für den Kunden ("Sie können sich entspannt zurücklehnen")

### Anrede – WICHTIGSTE REGEL
```
✅ RICHTIG:  "Hallo Herr Müller,"  /  "Hallo Frau Schmidt,"
❌ FALSCH:   "Sehr geehrte/r Damen und Herren"
❌ FALSCH:   "Du" (Kunden werden IMMER gesiezt)
```
Templates verwenden: `{Anrede}` (= "Herr"/"Frau") + `{Nachname}`

**Referenz:** `skills-marketing-the-black-book.md` im Projektverzeichnis

---

## Projektstruktur
```
/backend/src
  /db
    database.ts       - SQLite Schema + Default-Templates (Black Book) + Tabellen-Init
    seed.ts           - Testdaten (NUR wenn SEED_DATA=true in .env)
  /integrations
    /weclapp
      client.ts       - Weclapp API Client (sync, orders, customers, activities, comments)
    /gmail
      client.ts       - Gmail API Client (OAuth2 Refresh Token, Inbox + Send)
  /routes
    tasks.ts          - Aufgaben CRUD
    customers.ts      - Kunden CRUD
    templates.ts      - Template CRUD + Anwenden mit Variablen
    ai-suggestions.ts - Regel-basierte Template-Vorschläge
    daily-plan.ts     - Tagesplan (priorisierte Aufgaben mit Zeitschätzungen)
    email.ts          - E-Mail-Versand (Gmail → Microsoft Graph → mailto Fallback)
                        Inbox: GET /api/email/inbox
                        Senden: POST /api/email/send (speichert in emails-Tabelle + Weclapp)
                        Status: GET /api/email/status
                        Als gelesen markieren: POST /api/email/inbox/:id/read
    weclapp.ts        - Weclapp-Endpunkte (orders, customers, sync, sync-status)
    automations.ts    - Muster-Erkennung + n8n/Claude-Prompt-Generator (Black Book Sprache)
    chatbot.ts        - Q&A Chatbot + Training-Endpunkte (SpaVida Produkte)
    dashboard.ts      - Dashboard-Statistiken
  /services
    sync.ts           - Background-Jobs: Weclapp-Sync alle 15 min, Auto-Eskalation alle 5 min
  /utils
    rate-limiter.ts   - API Rate Limiting + Caching
  setup-gmail-oauth.ts - Einmaliges Setup-Skript für Gmail OAuth2 Refresh Token

/frontend/src
  /components
    /Layout
      Sidebar.tsx     - Navigation: Heute | Posteingang | Aufträge | Kunden | Vorlagen | Automatisierung
    /Dashboard        - Dashboard Widgets (DelayAlerts etc.)
    /DailyPlan        - Tagesplan-Ansicht
    /Today            - Today.tsx – Startbildschirm: Sofort/Heute/Diese Woche ✅
    /TaskDetail       - TaskDetailFull.tsx – Vollansicht mit Kontext + EmailComposer ✅
    /Email            - EmailComposer.tsx – E-Mail mit Vorlage + Weclapp-Ablage ✅
    /Inbox            - Inbox.tsx – Posteingang (Gmail oder Outlook) ✅
    /Automations      - AutomationSuggestions.tsx – n8n/Claude Prompts ✅
    /Chatbot          - ChatBot.tsx – floating Widget unten rechts ✅
    /Settings         - ChatbotTraining.tsx – Chatbot trainieren ✅
    /TaskList         - Aufgabenliste
    /Templates        - Vorlagen-Verwaltung
    /Analytics        - Analyse-Seite
    /CustomerView     - Kundenansicht
  /services
    unified.ts        - API Client (alle Backend-Calls)
  App.tsx             - Routing + Layout (Today als Standard-Route, ChatBot global)
```

---

## Datenbank Schema (SQLite)
```sql
-- Kern
customers (id, name, email, phone, company, hubspot_id, weclapp_id, created_at, updated_at)
tasks (id, title, description, source, type, priority, status, customer_id, external_id, due_date, metadata, created_at, updated_at)
templates (id, name, category, subject, content, placeholders, usage_count, task_types, keywords)

-- Auth & Audit
users (id, email, name, role CHECK('admin','support'), created_at)
actions_log (id, actor, action_type, entity_type, entity_id, payload_hash, created_at)

-- E-Mail & Kommunikation
emails (id, customer_id, direction, subject, body, recipient_email, sent_at, weclapp_synced, template_id, task_id)

-- Chatbot
chatbot_knowledge (id, question, answer, category, keywords, use_count, created_at, updated_at)

-- Sync & Muster
sync_log (id, source, sync_type, status, records_synced, error_message, started_at, completed_at)
activity_patterns (id, pattern_type, frequency, last_occurrence, metadata, created_at)
```

---

## API Endpoints (Vollständig)

### Tasks
- `GET /api/tasks` – Liste (Filter: status, priority, type, source)
- `GET /api/tasks/:id` – Einzeln
- `POST /api/tasks` – Erstellen
- `PATCH /api/tasks/:id` – Aktualisieren
- `DELETE /api/tasks/:id` – Löschen

### Customers
- `GET /api/customers` – Liste (Filter: search)
- `GET /api/customers/:id` – Einzeln

### Templates
- `GET /api/templates` – Liste
- `POST /api/templates` – Erstellen
- `PATCH /api/templates/:id` – Aktualisieren
- `DELETE /api/templates/:id` – Löschen
- `POST /api/templates/:id/apply` – Variablen befüllen

### AI Suggestions
- `POST /api/ai-suggestions` – Template-Vorschläge für eine Aufgabe
  - Input: `{ task_type, customer_id, order_id }`
  - Output: `{ suggestions: [{ template_id, filled_variables, preview }] }`

### Weclapp
- `GET /api/weclapp/test` – Verbindungstest
- `GET /api/weclapp/sync-status` – Letzter Sync, Anzahl Kunden/Aufgaben, isConfigured
- `GET /api/weclapp/orders` – Aufträge (page, pageSize, status)
- `GET /api/weclapp/orders/at-risk` – Risiko-Aufträge (zu alt / Lieferdatum überschritten)
- `GET /api/weclapp/orders/:id` – Einzelner Auftrag
- `PATCH /api/weclapp/orders/:id` – Auftrag aktualisieren
- `GET /api/weclapp/customers` – Kunden
- `GET /api/weclapp/customers/:id` – Einzelner Kunde
- `GET /api/weclapp/shipments` – Lieferungen
- `GET /api/weclapp/invoices` – Rechnungen (unpaidOnly)
- `GET /api/weclapp/stock` – Lagerbestand (articleId optional)
- `POST /api/weclapp/sync` – Sync starten (types: customers, orders)

### Daily Plan
- `GET /api/daily-plan` – Priorisierter Tagesplan mit Zeitschätzungen
- `PATCH /api/daily-plan/task/:id/done` – Aufgabe als erledigt markieren

### Email
- `POST /api/email/send` – E-Mail senden (Gmail → Microsoft Graph → mailto Fallback)
  - Input: `{ to, subject, body, customerId, taskId, templateId }`
  - Speichert in `emails` Tabelle + erstellt Weclapp-Kommentar beim Kunden
- `GET /api/email/inbox` – Posteingang abrufen (Gmail oder Microsoft Graph)
- `GET /api/email/status` – Aktiver E-Mail-Provider (gmail / microsoft / not_configured)
- `POST /api/email/inbox/:id/read` – E-Mail als gelesen markieren
- `GET /api/email/history/:customerId` – Lokale E-Mails + Weclapp-Aktivitäten zusammengeführt

### Automations
- `GET /api/automations` – Erkannte Muster + fertige n8n & Claude Prompts
- `POST /api/automations/track` – Aktion für Muster-Erkennung tracken

### Chatbot
- `POST /api/chatbot` – Frage stellen, bekommt Antwort aus Knowledge Base
- `GET /api/chatbot/knowledge` – Alle Trainings-Einträge
- `POST /api/chatbot/knowledge` – Neuen Eintrag hinzufügen
- `PATCH /api/chatbot/knowledge/:id` – Eintrag bearbeiten
- `DELETE /api/chatbot/knowledge/:id` – Eintrag löschen

### Dashboard
- `GET /api/dashboard` – Statistiken, Task-Übersicht, Weclapp-Status

---

## Was bereits fertig ist

| Feature | Status | Datei |
|---------|--------|-------|
| Weclapp API Client | ✅ | `backend/src/integrations/weclapp/client.ts` |
| Weclapp Sync (Background, 15 min) | ✅ | `backend/src/services/sync.ts` |
| Auto-Eskalation (überfällig → urgent) | ✅ | `backend/src/services/sync.ts` |
| Seed deaktiviert (nur wenn SEED_DATA=true) | ✅ | `backend/src/db/seed.ts` |
| E-Mail-Tabelle in DB | ✅ | `backend/src/db/database.ts` |
| Chatbot-Knowledge-Tabelle in DB | ✅ | `backend/src/db/database.ts` |
| 6 Black-Book-Templates (Anrede korrekt) | ✅ | `backend/src/db/database.ts` |
| Tagesplan-Route | ✅ | `backend/src/routes/daily-plan.ts` |
| Tagesplan-Frontend | ✅ | `frontend/src/components/DailyPlan/` |
| E-Mail-Route (Gmail → Graph → mailto) | ✅ | `backend/src/routes/email.ts` |
| Gmail Inbox + Senden (OAuth2) | ✅ | `backend/src/integrations/gmail/client.ts` |
| Gmail OAuth2 Setup-Skript | ✅ | `backend/src/setup-gmail-oauth.ts` |
| Automations-Route (Muster + Prompts) | ✅ | `backend/src/routes/automations.ts` |
| Chatbot-Route (Q&A + Training) | ✅ | `backend/src/routes/chatbot.ts` |
| Weclapp sync-status Endpoint | ✅ | `backend/src/routes/weclapp.ts` |
| Vite Proxy für /api | ✅ | `frontend/vite.config.ts` |
| Dashboard | ✅ | `frontend/src/components/Dashboard/` |
| Aufgabenliste | ✅ | `frontend/src/components/TaskList/` |
| Vorlagen-Verwaltung | ✅ | `frontend/src/components/Templates/` |
| Today – Startbildschirm | ✅ | `frontend/src/components/Today/Today.tsx` |
| TaskDetailFull – Vollansicht | ✅ | `frontend/src/components/TaskDetail/TaskDetailFull.tsx` |
| EmailComposer – E-Mail Editor | ✅ | `frontend/src/components/Email/EmailComposer.tsx` |
| Posteingang (Inbox) | ✅ | `frontend/src/components/Inbox/Inbox.tsx` |
| AutomationSuggestions | ✅ | `frontend/src/components/Automations/AutomationSuggestions.tsx` |
| ChatBot Widget (floating) | ✅ | `frontend/src/components/Chatbot/ChatBot.tsx` |
| ChatbotTraining | ✅ | `frontend/src/components/Settings/ChatbotTraining.tsx` |
| Sidebar (Heute/Posteingang/Aufträge...) | ✅ | `frontend/src/components/Layout/Sidebar.tsx` |
| App.tsx (Routing + ChatBot global) | ✅ | `frontend/src/App.tsx` |

---

## Offene Punkte (TODO)

| Was | Datei | Priorität |
|-----|-------|-----------|
| Gmail Refresh Token einrichten | `backend/.env` + `npx tsx src/setup-gmail-oauth.ts` | 🔴 JETZT |
| Kunden-Linking prüfen (upsertCustomerFromOrder) | `backend/src/integrations/weclapp/client.ts` | 🟡 |

### Gmail OAuth2 – Noch ausstehend
`GMAIL_REFRESH_TOKEN` fehlt noch in `backend/.env`. Einmalige Einrichtung:
```bash
# Im backend/ Ordner (neues Terminal öffnen):
cd C:\claudeprojekte\Kundensupport\backend
npx tsx src/setup-gmail-oauth.ts
```
→ Link öffnen → mit `mail@direktvomhersteller.de` anmelden (ggf. Inkognito-Fenster) → Token in `.env` eintragen

---

## Weclapp Integration Details
- **Base URL:** `https://hixuvzwshzpqhhd.weclapp.com/webapp/api/v1`
- **Auth:** Header `AuthenticationToken: <token>`
- **Rate Limit:** Max 100 req/min, Exponential Backoff bei 429
- **Caching:** 5 Min In-Memory für häufige Abfragen
- **Sync:** Background-Job alle 15 Minuten, speichert in SQLite
- **Wichtige Endpunkte:**
  - `GET /customer` – Kundenliste
  - `GET /salesOrder` – Aufträge
  - `GET /shipment` – Lieferungen
  - `GET /invoice` – Rechnungen
  - `POST /customer/id/{id}/createComment` – Aktivität/Kommentar beim Kunden speichern

---

## Chatbot – Produkt-Wissen (SpaVida® Whirlpools)
direktvomhersteller.de verkauft Whirlpools & Spa-Systeme der Marke SpaVida®:
- Whirlpool-Badewannen (indoor, ~31 Modelle, ca. 3.500 – 8.000 €)
- Whirlpoolsysteme MultiSpa Deluxe bis Exclusive (~37 Modelle)
- Outdoor-Whirlpools (~8–12 Modelle, 7.490 – 14.490 €)
- Eiswannen, Gewerbe-Spa
- Lieferzeiten: 2–5 Tage bis 16 Wochen je nach Modell
- Website: https://www.direktvomhersteller.de/

8 initiale Wissensbasis-Einträge werden beim Start automatisch angelegt (in `chatbot.ts`).
Weitere Einträge über Trainings-UI oder `POST /api/chatbot/knowledge` hinzufügen.

---

## Konventionen
- TypeScript strict mode
- Deutsche UI-Texte, Englische Code-Kommentare
- Alle Nutzer-Aktionen in `actions_log` protokollieren
- Templates nur in SQLite speichern (nicht in n8n duplizieren)
- IMMER Black Book Prinzipien + korrekte Anrede anwenden
- Weclapp ist die einzige Wahrheitsquelle für Kundendaten
- Gmail ist primärer E-Mail-Provider, Microsoft Graph als Fallback

---

## Bekannte Fixes (nicht rückgängig machen)
- `frontend/vite.config.ts`: Proxy `/api` → `http://localhost:3001` (ohne Proxy: CORS-Fehler)
- `DelayAlerts.tsx`: `Number(order.totalAmount).toFixed(2)` – Weclapp gibt Zahl als String zurück
- `weclapp.ts` riskOrder: `const aRisk = a.riskLevel as 'high' | 'medium' | 'low'` – TS7053 Fix
- `seed.ts`: Guard `if (process.env.SEED_DATA !== 'true') return` – verhindert Testdaten-Überschreibung
- `gmail/client.ts`: OAuth2 Refresh Token statt Service Account (Org-Policy blockiert JSON-Keys)
- `weclapp/client.ts`: `upsertCustomerFromOrder()` – erstellt Kunden aus Auftragsadresse wenn nicht in DB
