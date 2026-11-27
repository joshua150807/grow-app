# KI Mentor – Konzept & Plan

Stand: 27.11.2026
Status: Planung (noch kein Code). Kernentscheidungen am 27.11.2026 von Joshua bestätigt (siehe Abschnitt 9).

Bezug: `docs/grow_appstore_release_plan.md` (Abschnitt 7), `docs/roadmap/app-store-release-plan.md` (Product Slice 7).

---

## 1. Vision (Kurzform)

Der KI Mentor ist ein **persönlicher Coach**, kein Allzweck-Chatbot.
Er ist schmaler als ChatGPT (keine Briefe, kein Allgemeinwissen), dafür:

- erinnert er sich langfristig an den User,
- kennt er die echten Grow-Daten (Training, Habits, Ziele, Todos, Journal …),
- kann er direkt in Grow handeln (Habit anlegen, Trainingseinheit eintragen …),
- motiviert, fordert und hilft er.

Kreislauf: Motivation → Handlung → Fortschritt → neue Motivation.

## 2. Themenfelder

| Im Fokus | Nicht im Fokus (höflich ablehnen, zurück zum Coaching) |
|---|---|
| Training, Fitness, Regeneration (allgemein, keine Diagnose) | Briefe/Texte schreiben |
| Gewohnheiten, Disziplin, Produktivität, Fokus | Allgemeinwissen, Hausaufgaben, Code |
| Ziele, Planung, Selbstentwicklung, Mindset | Nachrichten/Politik |
| Business/Karriere: Ideen, Strategie, Prioritäten | Rechts-/Steuer-/Anlageberatung |
| Buch-/Lernempfehlungen | Medizinische Diagnosen/Therapie |

## 3. Ist-Zustand im Repo (relevant für den Mentor)

- Backend `apps/api` (Fastify, `/v1`, Zod, Auth, Tests) ist vorhanden und tragfähig.
- Mentor-Screen ist nur ein Platzhalter-Bild.
- **Fast alle Tools schreiben direkt aus dem Client nach Supabase** (`training_*`, `habits`, `goals`, `todos`, `journal_entries`, `notes`, `daily_planner_events`, …). Backend-Endpunkte gibt es bisher nur für Profil, Creator, Habit-Collections, Deep Work.
  → Damit der Mentor sicher schreiben kann, braucht jedes Tool, das er bearbeiten darf, eine **Backend-Schreiblogik**. Das ist der größte Aufwandsblock.
- Training speichert pro Übung `weight`, `sets`, `reps`, `note` und pro Session eine `note`. **Es gibt keine Links/Rechts-Erfassung.** Ein Seitenungleichgewicht kann der Mentor daher nur erkennen, wenn der User es erwähnt oder einseitige Übungen getrennt einträgt.

## 4. Architektur

### 4.1 Gedächtnis in drei Schichten

1. **Gesprächsverlauf** – letzte N Nachrichten der aktuellen Konversation.
2. **Langzeit-Memory (`mentor_memories`)** – kurze, strukturierte Fakten, die nach jeder Nachricht automatisch extrahiert werden.
   Beispiel: `{ kategorie: "gesundheit", inhalt: "Verletzung am linken Bein beim Training", datum: 2026-03-12, status: "aktiv", quelle: message_id }`
   - Der User sieht im Bereich „Was der Mentor über mich weiß“ alle Fakten, kann sie bearbeiten und löschen.
   - Kategorien: Ziele, Gesundheit/Verletzungen, Vorlieben, Business, Persönlichkeit, Herausforderungen …
   - In V1 ohne Vektor-Datenbank: Pro User sind es überschaubar viele Fakten, die gefiltert und priorisiert in den Prompt gehen. Embeddings kommen erst, wenn das nicht mehr reicht.
3. **Live-App-Daten** – nicht pauschal in den Prompt kopiert, sondern **bei Bedarf über Lese-Tools geholt** (Tool Use / Function Calling), z. B. `get_training_history(exercise, zeitraum)`, `get_habits()`, `get_goals()`.

Zusätzlich gibt es **rollierende Zusammenfassungen** pro Konversation bzw. Woche, damit lange Verläufe nicht unbegrenzt Tokens kosten.

### 4.2 Handlungen (Schreibzugriff)

- Der Mentor schlägt Aktionen über Tools vor (`create_habit`, `log_training_session`, `create_todo`, `create_goal` …).
- **V1: Jede Schreibaktion erzeugt eine Bestätigungskarte in der App** („Gewohnheit ‚10 Seiten lesen‘ täglich anlegen? ✓ / ✗“). Ausgeführt wird erst nach dem Tap.
- **Kein Löschen durch den Mentor in V1.**
- Die Ausführung läuft im Backend. Als User-ID gilt immer die aus dem JWT, nie eine vom Modell gelieferte ID. Validierung erfolgt mit denselben Zod-Schemas wie bei normalen API-Calls.
- Jede ausgeführte Aktion wird protokolliert (`mentor_actions`) und ist für den User nachvollziehbar.
- Später optional „Auto-Modus“ pro Aktionstyp, wenn sich die Bestätigungen bewährt haben.

### 4.3 Provider

- Provider-Schicht mit Mock zuerst (Entscheidung von Joshua).
- Für Memory-Extraktion und Tool Use braucht es später ein **starkes Modell mit zuverlässigem Function Calling**. Die Auswahl fällt vor Ticket M4, inklusive Kostenrechnung pro aktivem User/Monat.
- API Key nur im Backend.

### 4.4 Datenmodell (Entwurf)

- `mentor_conversations` (id, user_id, title, summary, created_at, updated_at)
- `mentor_messages` (id, conversation_id, user_id, role, content, prompt_version, token_usage, created_at)
- `mentor_memories` (id, user_id, category, content, status, source_message_id, valid_from, created_at, updated_at)
- `mentor_actions` (id, user_id, message_id, type, payload, status `proposed|confirmed|rejected|failed`, result_ref, created_at)
- `mentor_usage` (user_id, day, messages, tokens) für Quotas
- `mentor_settings` (user_id, persona, memory_enabled, data_access_scopes, consent_at)

Alle Tabellen bekommen RLS, FK auf `auth.users` mit `on delete cascade` und Check Constraints. Der Client hat keinen direkten Schreibzugriff, die Grenze ist das Backend.

## 5. Recht, Datenschutz, App Store (Release-relevant)

- **Gesundheitsdaten** (Verletzungen, Training) sind besondere Kategorien nach Art. 9 DSGVO → **ausdrückliche Einwilligung** nötig, bevor der Mentor sie speichert oder an den KI-Anbieter schickt.
- Weitergabe an einen KI-Anbieter: Auftragsverarbeitungsvertrag, Datenschutzerklärung, Angaben im App Store.
- Apple verlangt Transparenz und Zustimmung, bevor personenbezogene Daten an Dritt-KI gehen → Onboarding-Screen mit Opt-in für den Mentor.
- Bei Gesundheitsthemen gibt der Mentor allgemeine Tipps und verweist bei Schmerzen/Verletzungen klar an Arzt/Physio. Bei Krisensignalen nennt er Hilfsangebote.
- Keine Inhalte aus Chats in Logs.
- Datenexport/Löschung: Chats und Memory werden mit dem Account gelöscht und sind zusätzlich einzeln löschbar.

## 6. Stufen & grobe Zeitschätzung

Annahme: 1 Entwickler mit KI-Unterstützung, Vollzeit-nah. Die Werte sind grob, Risiko eher nach oben.

### Stufe 1 – Mentor V1 (Release-Muss), ca. 10–14 Wochen
- Mehrere Chats (Chatliste, automatische Titel, umbenennen/löschen); Memory gilt chatübergreifend pro User
- Persona + Themenbegrenzung + Safety
- Langzeit-Memory mit Ansicht „Was der Mentor über mich weiß“
- Generisches Aktions-Framework (Vorschlag → Bestätigungskarte → Backend-Ausführung → Protokoll)
- Lese- **und** Schreibzugriff (mit Bestätigung, ohne Löschen) auf **alle Tools**, in Wellen:
  - Welle A: Habits, Todos, Training
  - Welle B: Ziele, Daily Planner, Deep Work
  - Welle C: Journal, Notizen, Affirmationen, Leitfragen
- Rate Limits, Tageskontingent, Kostendeckel
- Einwilligung/Opt-in (Journal/Notizen als eigener Datenzugriffs-Schalter), Datenschutztexte
- Tests (Ownership, Validation, Quota, Aktionen) + interne Beta

### Stufe 2 – Nach Release, ca. 4–6 Wochen
- Fortschrittsanalyse: wöchentliche Auswertung der echten Daten
- Persona-Wahl (fordernd / unterstützend / analytisch)
- Feedback 👍/👎 + Auswertung, Admin-Diagnose

### Stufe 3 – Später, ca. 6–8 Wochen
- Proaktives Coaching (Check-ins, Wochenreview per Push)
- Mustererkennung über Monate (z. B. Leistungsentwicklung je Übung, ggf. Links/Rechts-Erfassung im Training)
- Streaming, Embeddings/semantische Suche falls nötig
- Evaluations-Set für Coaching-Qualität

## 7. Planungsphasen (verdichtet)

Die 10 Phasen aus dem ChatGPT-Entwurf sind sinnvoll, aber für den Stand des Repos zu schwer. Vorschlag in 4 Schritten:

1. **Produkt-Entscheidungen** (dieses Dokument): Scope V1, Themen, Persona, Datenzugriff, Bestätigungslogik, Limits.
2. **Memory- und Aktions-Design**: Fakt-Schema, Extraktionsregeln, Tool-Liste mit genauen Parametern.
3. **Technische Tickets M1–M8** (unten), je eines nach dem anderen.
4. **UI/UX** parallel zu M5–M7.

## 8. Tickets (Entwurf)

| # | Ticket | Stufe |
|---|---|---|
| M1 | Datenmodell + Migration + RLS (Conversations, Messages, Usage, Settings) | 1 |
| M2 | Mentor-Modul + Provider-Schicht (Mock) + Prompt-Versionierung + Safety | 1 |
| M3 | Chat-API (`/v1/mentor/...`, mehrere Chats) + Limits + Tests | 1 |
| M4 | Provider-Entscheidung + echte Anbindung + Kostenrechnung | 1 |
| M5 | Mobile Chat-UI (Chatliste + Chat) + Opt-in/Einwilligung | 1 |
| M6 | Langzeit-Memory (Extraktion, Speicherung, Ansicht/Löschen) | 1 |
| M7 | Aktions-Framework (`mentor_actions`, Bestätigungskarte, Ausführung, Protokoll) | 1 |
| M8 | Welle A: Backend-Lese/Schreib-Endpunkte + Mentor-Tools für Habits, Todos, Training | 1 |
| M9 | Welle B: Ziele, Daily Planner, Deep Work | 1 |
| M10 | Welle C: Journal, Notizen, Affirmationen, Leitfragen | 1 |
| M11+ | Stufe 2/3 | 2–3 |

Hinweis: Die neuen Backend-Endpunkte werden additiv gebaut. Die App schreibt vorerst weiter direkt (keine unnötigen Mobile-Umbauten, alte EAS-Builds bleiben funktionsfähig). Später kann die App schrittweise auf dieselben Endpunkte umgestellt werden.

## 9. Entscheidungen

| Thema | Entscheidung |
|---|---|
| KI-Anbieter | Offen, Mock zuerst; Entscheidung vor M4 |
| Chat-History | Wird gespeichert |
| Streaming | Nicht in V1 |
| Schreibaktionen | Immer mit Bestätigung in V1, kein Löschen |
| Schreibbare Tools | **Alle Tools in V1**, Start mit Habits/Todos/Training |
| Chats | **Mehrere Chats**, Memory chatübergreifend |
| Zeitrahmen | Qualität vor Tempo, ca. 10–14 Wochen akzeptiert |
| Tageslimit | Offen (Env-konfigurierbar) |
| Persona | Vorschlag: fix in V1, Wahl in Stufe 2 – offen |
