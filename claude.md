# Kundensupport-Automatisierung

## Projektübersicht
Automatisierungs-App für One-Man-Kundensupport bei direktvomhersteller.de. Integriert mit Weclapp ERP zur Auftragsverarbeitung, Kundenverwaltung und proaktiven Kommunikation.

## Tech Stack
- **Backend:** Node.js, TypeScript, Express, SQLite (better-sqlite3)
- **Frontend:** React 19, TypeScript, TailwindCSS, Vite
- **Integrationen:** Weclapp API, Microsoft Graph API (geplant)
- **Automatisierung:** n8n Workflows

## Projektstruktur
```
/backend
  /src
    /db           - SQLite Schema und Seed-Daten
    /integrations - Weclapp/Microsoft API Clients
    /routes       - Express REST Endpoints
    /middleware   - Auth, Rate Limiting
    /utils        - Hilfsfunktionen
  /data           - SQLite Datenbank

/frontend
  /src
    /components   - React Komponenten
    /services     - API Client
    /utils        - Hilfsfunktionen

/n8n-workflows    - Workflow JSON Definitionen
/docs             - Dokumentation
```

## Wichtige Dateien
| Datei | Beschreibung |
|-------|--------------|
| `backend/src/db/database.ts` | SQLite Schema (customers, tasks, templates, users, actions_log) |
| `backend/src/integrations/weclapp/client.ts` | Weclapp API Client |
| `backend/src/routes/templates.ts` | Template CRUD + Anwendung |
| `backend/src/routes/ai-suggestions.ts` | Regel-basierte Template-Vorschläge |
| `frontend/src/components/Dashboard/` | Dashboard mit Widgets |

## API Endpoints

### Templates
- `GET /api/templates` - Liste (Filter: category)
- `GET /api/templates/:id` - Einzeln
- `POST /api/templates` - Erstellen
- `PATCH /api/templates/:id` - Aktualisieren
- `DELETE /api/templates/:id` - Löschen
- `POST /api/templates/:id/apply` - Anwenden mit Variablen

### AI-Suggestions
- `POST /api/ai-suggestions` - Template-Vorschläge mit ausgefüllten Variablen
  - Input: `{ task_type, customer_id, order_id }`
  - Output: `{ suggestions: [{ template_id, filled_variables, preview }] }`

### Weclapp
- `GET /api/weclapp/test` - Verbindungstest
- `GET /api/weclapp/orders` - Aufträge
- `GET /api/weclapp/orders/at-risk` - Überfällige Aufträge
- `POST /api/weclapp/sync` - Synchronisation

## Datenbank Schema
```sql
-- Kerntabellen
customers (id, name, email, phone, company, weclapp_id)
tasks (id, title, type, priority, status, customer_id, external_id, metadata)
templates (id, name, category, subject, content, placeholders, task_types, usage_count)

-- Auth & Audit
users (id, email, name, role)
actions_log (id, actor, action_type, entity_type, entity_id, payload_hash, created_at)
```

## Rollenmodell
| Rolle | Templates | Tasks | Settings | Logs |
|-------|-----------|-------|----------|------|
| admin | CRUD | CRUD | Ja | Alle |
| support | Lesen | CRUD | Nein | Eigene |

## Weclapp Integration
- **Auth:** Token via `AuthenticationToken` Header
- **Base URL:** `https://{tenant}.weclapp.com/webapp/api/v1`
- **Rate Limit:** Max 100 req/min, Exponential Backoff bei 429
- **Caching:** 5 Min In-Memory für häufige Abfragen

## Entwicklung
```bash
# Backend starten
cd backend && npm install && npm run dev

# Frontend starten
cd frontend && npm install && npm run dev
```

## Umgebungsvariablen
```env
# Backend (.env)
PORT=3001
WECLAPP_TENANT=your-tenant
WECLAPP_API_TOKEN=your-token
OPENAI_API_KEY=your-key  # Für Phase 2
```

## Konventionen
- TypeScript strict mode
- Deutsche UI-Texte, Englische Code-Kommentare
- Alle Aktionen in actions_log protokollieren
- Templates nur in DB speichern (nicht in n8n duplizieren)
