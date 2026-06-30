# AGENTS.md — Grow

## Projektziel

Grow soll als erste öffentliche Production-Version in den App Store.
Stabilität, Sicherheit und klare Backend-Grenzen haben Vorrang vor schneller Feature-Masse.

## Wichtige Referenzen

Vor größeren Änderungen lesen:
- docs/grow_appstore_release_plan.md
- docs/architecture-security-review-notes.md

## Arbeitsregeln für Codex

- Keine großen Umbauten ohne vorherigen Plan.
- Immer nur ein klar abgegrenztes Ticket umsetzen.
- Bestehende Mobile-App-Logik nicht unnötig anfassen.
- Keine Secrets oder API Keys in den Client.
- Kritische Businesslogik gehört ins Backend, nicht in den Client.
- Supabase bleibt DB/Auth, aber direkte kritische DB-/Storage-Zugriffe sollen schrittweise aus der App ins Backend wandern.
- Backend bevorzugt mit klarer Struktur: Routes, Services, Repositories, Validation, Middleware, Error Handling, Logging.
- Zentrale Validation mit Zod verwenden.
- API-Versionierung mit /v1 verwenden.
- EAS Updates beachten: API-Änderungen dürfen alte Builds nicht unnötig brechen.
- Service Role Key nur im Backend verwenden und niemals im Client.
- Wenn Service Role genutzt wird, muss das Backend Rollen, Ownership und Berechtigungen selbst prüfen.
- Neue Features brauchen sinnvolle Fehlerbehandlung.
- Bei sicherheitskritischen Änderungen Tests oder zumindest klare Testanweisungen ergänzen.

## Release-Muss

- Backend-Fundament
- Profilsystem V1
- KI Mentor V1
- Creator-System V1
- Video-Upload V1
- KI-Empfehlung + manuelle Video-Freigabe
- Admin/CEO Dashboard für Moderation
- Feed-Stabilität
- App Store Pflichtkram

## Nicht blind machen

- Keine komplette Monorepo-Migration ohne Freigabe.
- Keine automatische Video-Freigabe zum Start.
- Keine Ads/Affiliate-Aktivierung vor öffentlichem Release.
- Keine privaten Chats erzwingen, wenn Release dadurch riskant wird.