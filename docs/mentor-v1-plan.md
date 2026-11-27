# KI Mentor V1 – Plan

Stand: 27.11.2026
Status: Planung – wartet auf genauere Produktdefinition durch Joshua

Bezug: `docs/grow_appstore_release_plan.md` (Abschnitt 7), `docs/roadmap/app-store-release-plan.md` (Product Slice 7).

---

## Ist-Zustand

- Mobile: `apps/mobile/features/mentor/screens/MentorScreen.jsx` zeigt nur ein Hintergrundbild, keine Chat-Logik.
- Backend: keine Mentor-Routen, keine Mentor-Tabellen.
- Backend-Muster vorhanden: Fastify, `/v1`, Zod, `requireAuth` (Supabase JWT), `AppError`, Routes → Service → Repository, Vitest.

## Getroffene Entscheidungen

| Thema | Entscheidung |
|---|---|
| KI-Anbieter | Noch offen. V1 startet mit Provider-Schicht + **Mock-Provider**. Echter Anbieter wird später per Env angebunden. |
| Chat-History | **Wird gespeichert** (Supabase, neue Tabellen). User kann löschen, Account-Löschung löscht mit (`on delete cascade`). |
| Streaming | **Nicht in V1.** Ladezustand → komplette Antwort. Streaming nach Release/später. |
| Tageslimit | Offen – kommt mit der Produktdefinition. Wird per Env konfigurierbar. |

## Offen (kommt mit Produktdefinition)

- Rolle/Persönlichkeit des Mentors, Tonalität, Themenbereiche
- Welcher User-Kontext genutzt werden darf (Ziele, Habits, Training, Journal …)
- Eine Konversation oder mehrere Chats pro User
- Tageslimit / Quotas
- Gewünschte UI (Starter-Fragen, Vorschläge, etc.)

## Tickets (je ein Ticket pro Umsetzung)

### M1 – Datenmodell + Backend-Modul
- Migration: `mentor_conversations`, `mentor_messages`
  - FK auf `auth.users` mit `on delete cascade`
  - Check Constraints (`role in ('user','assistant')`, Längen)
  - Indizes auf `user_id`, `conversation_id`, `created_at`
  - RLS aktiv; Client bekommt keinen direkten Schreibzugriff (Backend ist die Grenze)
- `apps/api/src/modules/mentor/`: Schemas (Zod), Repository, Service
- Backend prüft Ownership selbst (Service Role)

### M2 – Provider-Schicht + Safety
- Interface `MentorProvider` (`generateReply(messages, options)`)
- `MockMentorProvider` als Default; echter Provider später
- Versionierter System-Prompt (`promptVersion` wird pro Antwort gespeichert)
- Safety-Grenzen: keine medizinischen/rechtlichen/finanziellen Versprechen, Krisen-Hinweis auf Hilfsangebote
- Timeouts, Provider-Fehler → saubere `AppError`s
- API Key nur als Server-Env, nie im Client

### M3 – Limits
- Max. Nachrichtenlänge (Zod)
- Rate Limit pro User (Burst) + Tageskontingent (Wert offen, per Env)
- Begrenzte History im Prompt (letzte N Nachrichten), Max-Output-Tokens

### M4 – API
- `POST /v1/mentor/messages` (neue oder bestehende Konversation)
- `GET /v1/mentor/conversations`
- `GET /v1/mentor/conversations/:id/messages` (paginiert)
- `DELETE /v1/mentor/conversations/:id`
- Tests: Auth, Ownership (fremde IDs), Validation, Quota, Provider-Fehler

### M5 – Mobile Chat-UI
- `MentorScreen` zu Chat umbauen (bestehenden Hintergrund/Stil wiederverwenden)
- States: Laden, Fehler, leer, Quota erreicht, Safety-Hinweis
- KI-Hinweis ("Antworten können fehlerhaft sein, kein Ersatz für Fachleute")
- API-Client analog `features/profile/services/profiles.js`

### M6 – Nach V1
- Streaming
- Personalisierung mit User-Kontext
- Feedback (👍/👎) pro Antwort
- Admin-Diagnose (Nutzung, Fehler, Kosten)

## Risiken

- Kosten ohne Limits → M3 ist Release-Muss.
- App Store: KI-Hinweise + Altersfreigabe prüfen.
- Datenschutz: Chat-Inhalte sind sensibel → Löschfunktion, Datenschutzerklärung ergänzen, keine Inhalte in Logs.
- EAS Updates: neue Endpunkte sind additiv, alte Builds brechen nicht.
