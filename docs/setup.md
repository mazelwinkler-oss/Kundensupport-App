# Kundensupport-Zentrale - Setup Anleitung

## Voraussetzungen

- Node.js 18 oder hoeher
- npm 9 oder hoeher
- n8n (optional, fuer Automatisierungen)

## Installation

### 1. Repository klonen

```bash
cd C:\claudeprojekte\Kundensupport
```

### 2. Backend installieren

```bash
cd backend
npm install
```

### 3. Frontend installieren

```bash
cd frontend
npm install
```

### 4. Umgebungsvariablen konfigurieren

Kopieren Sie die Beispiel-Umgebungsdatei:

```bash
cd backend
copy .env.example .env
```

Bearbeiten Sie die `.env` Datei mit Ihren API-Zugangsdaten:

```
PORT=3001

# HubSpot - Aus Einstellungen > Integrationen > Private Apps
HUBSPOT_ACCESS_TOKEN=pat-xxx-xxx-xxx

# Weclapp - Aus Einstellungen > API
WECLAPP_TENANT=ihre-firma
WECLAPP_API_TOKEN=xxx-xxx-xxx
```

## Starten

### Backend starten

```bash
cd backend
npm run dev
```

Das Backend laeuft unter: http://localhost:3001

### Frontend starten

```bash
cd frontend
npm run dev
```

Das Frontend laeuft unter: http://localhost:5173

## API-Endpunkte testen

### Gesundheitscheck
```bash
curl http://localhost:3001/api/health
```

### HubSpot-Verbindung testen
```bash
curl http://localhost:3001/api/hubspot/test
```

### Weclapp-Verbindung testen
```bash
curl http://localhost:3001/api/weclapp/test
```

## n8n Workflows einrichten

1. Importieren Sie die Workflow-Dateien aus dem `n8n-workflows/` Verzeichnis
2. Konfigurieren Sie die Credentials:
   - HubSpot API
   - SMTP fuer E-Mail-Versand
3. Aktivieren Sie die Workflows

## Datenbank

Die SQLite-Datenbank wird automatisch beim ersten Start erstellt unter:
`backend/data/support.db`

### Datenbank zuruecksetzen

```bash
cd backend
rm data/support.db
npm run dev
```

## Fehlerbehebung

### Port bereits belegt

```bash
# Windows
netstat -ano | findstr :3001
taskkill /PID <PID> /F

# Alternative Ports in .env konfigurieren
PORT=3002
```

### HubSpot-Verbindungsfehler

1. Pruefen Sie ob der Access Token gueltig ist
2. Stellen Sie sicher, dass die Private App die benoetigten Scopes hat:
   - crm.objects.contacts.read
   - crm.objects.deals.read
   - crm.objects.tickets.read
   - crm.objects.tickets.write

### Weclapp-Verbindungsfehler

1. Pruefen Sie ob der Tenant-Name korrekt ist
2. Stellen Sie sicher, dass der API-Token gueltig ist
3. Pruefen Sie die API-Berechtigungen in Weclapp
