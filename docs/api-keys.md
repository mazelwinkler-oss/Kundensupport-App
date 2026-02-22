# API-Keys Konfiguration

## HubSpot Private App erstellen

### Schritt 1: Private App anlegen

1. Gehen Sie zu HubSpot > Einstellungen > Integrationen > Private Apps
2. Klicken Sie auf "Private App erstellen"
3. Geben Sie einen Namen ein: "Support-Zentrale"

### Schritt 2: Berechtigungen konfigurieren

Aktivieren Sie folgende Scopes:

**CRM:**
- `crm.objects.contacts.read` - Kontakte lesen
- `crm.objects.contacts.write` - Kontakte erstellen/aktualisieren
- `crm.objects.deals.read` - Deals/Leads lesen
- `crm.objects.deals.write` - Deals erstellen/aktualisieren
- `crm.objects.tickets.read` - Tickets lesen
- `crm.objects.tickets.write` - Tickets erstellen/aktualisieren

**Optional fuer Aircall-Integration:**
- `crm.objects.calls.read` - Anrufe lesen

### Schritt 3: Access Token kopieren

Nach dem Erstellen der App erhalten Sie einen Access Token.
Dieser beginnt mit `pat-` und sieht so aus:

```
pat-eu1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

Speichern Sie diesen Token sicher - er wird nur einmal angezeigt!

---

## Weclapp API-Token erstellen

### Schritt 1: API-Einstellungen oeffnen

1. Melden Sie sich bei Weclapp an
2. Gehen Sie zu Einstellungen (Zahnrad-Symbol)
3. Waehlen Sie "API" oder "Integrationen"

### Schritt 2: Token generieren

1. Klicken Sie auf "Neuen API-Token erstellen"
2. Geben Sie eine Beschreibung ein: "Support-Zentrale"
3. Waehlen Sie die benoetigten Berechtigungen:
   - Kunden lesen
   - Auftraege lesen
   - Auftraege schreiben
   - Rechnungen lesen
   - Versand lesen
   - Lagerbestand lesen

### Schritt 3: Token und Tenant notieren

Sie benoetigen:

1. **API-Token**: Sieht ungefaehr so aus: `abc123-def456-ghi789`
2. **Tenant**: Ihr Weclapp-Subdomain, z.B. wenn Ihre URL `meinefirma.weclapp.com` ist, dann ist der Tenant `meinefirma`

---

## Umgebungsvariablen konfigurieren

Erstellen Sie eine `.env` Datei im Backend-Verzeichnis:

```bash
cd backend
copy .env.example .env
```

Bearbeiten Sie die Datei:

```env
# Server-Port
PORT=3001

# HubSpot
HUBSPOT_ACCESS_TOKEN=pat-eu1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# Weclapp
WECLAPP_TENANT=meinefirma
WECLAPP_API_TOKEN=abc123-def456-ghi789
```

---

## Verbindung testen

Nach dem Konfigurieren der API-Keys, starten Sie das Backend:

```bash
cd backend
npm run dev
```

Testen Sie die Verbindungen:

```bash
# HubSpot
curl http://localhost:3001/api/hubspot/test

# Weclapp
curl http://localhost:3001/api/weclapp/test
```

Erwartete Antwort bei Erfolg:
```json
{"status":"connected","message":"HubSpot connection successful"}
```

---

## Sicherheitshinweise

1. **Niemals API-Keys committen!** Die `.env` Datei sollte in `.gitignore` stehen
2. **Beschraenkte Berechtigungen**: Geben Sie nur die minimal notwendigen Rechte
3. **Token regelmaessig erneuern**: Rotieren Sie die Tokens alle 90 Tage
4. **Zugriff protokollieren**: Aktivieren Sie API-Logs in HubSpot und Weclapp

---

## n8n Webhook URLs

Nach dem Einrichten von n8n erhalten Sie Webhook-URLs fuer:

| Workflow | Endpoint |
|----------|----------|
| E-Mail zu Ticket | `https://n8n.ihre-domain.de/webhook/email-to-ticket` |
| Versandbenachrichtigung | `https://n8n.ihre-domain.de/webhook/shipment-created` |

Diese URLs muessen in den jeweiligen Quellsystemen als Webhook-Empfaenger konfiguriert werden.
