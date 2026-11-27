# KI Mentor – Konzept & Plan

Stand: 27.11.2026
Status: In Umsetzung. Kernentscheidungen am 27.11.2026 von Joshua bestätigt (siehe Abschnitt 9).

> **Entscheidung Gründerteam (27.11.2026):** Der KI Mentor wird fertig gebaut, bis er theoretisch live gehen kann, aber **erst aktiviert, wenn Grow Cashflow hat**. Er ist damit kein Muss für den ersten öffentlichen Release mehr. Bis dahin bleiben `MENTOR_ENABLED` (Backend) und `EXPO_PUBLIC_MENTOR_API_ENABLED` (App) aus, es ist kein Anthropic-Konto hinterlegt und die Migrationen werden nicht in Production angewendet.

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
| M1 ✅ | Datenmodell + Migration + RLS (Conversations, Messages, Usage, Settings) | 1 |
| M2 ✅ | Mentor-Modul + Provider-Schicht (Mock) + Prompt-Versionierung + Safety | 1 |
| M3 ✅ | Chat-API (`/v1/mentor/...`, mehrere Chats) + Limits + Tests | 1 |
| M4 ✅ | Provider-Entscheidung + echte Anbindung + Kostenrechnung | 1 |
| M5 ✅ | Mobile Chat-UI (Chatliste + Chat) + Opt-in/Einwilligung | 1 |
| M6 ✅ | Langzeit-Memory (Extraktion, Speicherung, Ansicht/Löschen) | 1 |
| M7 ✅ | Aktions-Framework (`mentor_actions`, Bestätigungskarte, Ausführung, Protokoll) | 1 |
| M8 ✅ | Welle A: Mentor-Tools für Habits und Todos (Training zurückgestellt) | 1 |
| M8b | Training (Lesen + Schreiben) – wartet auf Erklärung des Trainingsplans durch Joshua | 1 |
| M9 | Welle B: Ziele, Daily Planner, Deep Work | 1 |
| M10 | Welle C: Journal, Notizen, Affirmationen, Leitfragen | 1 |
| M11+ | Stufe 2/3 | 2–3 |

Hinweis: Die neuen Backend-Endpunkte werden additiv gebaut. Die App schreibt vorerst weiter direkt (keine unnötigen Mobile-Umbauten, alte EAS-Builds bleiben funktionsfähig). Später kann die App schrittweise auf dieselben Endpunkte umgestellt werden.

## 9. Entscheidungen

| Thema | Entscheidung |
|---|---|
| KI-Anbieter | **Anthropic: Claude Sonnet 5.5** (Hauptmodell) + **Claude Haiku 5.5** (Memory, Titel). Kosten: `docs/mentor-provider-costs.md` |
| Chat-History | Wird gespeichert |
| Streaming | Nicht in V1 |
| Schreibaktionen | Immer mit Bestätigung in V1, kein Löschen |
| Schreibbare Tools | **Alle Tools in V1**, Start mit Habits/Todos/Training |
| Chats | **Mehrere Chats**, Memory chatübergreifend |
| Zeitrahmen | Qualität vor Tempo, ca. 10–14 Wochen akzeptiert |
| Aktivierung | Erst wenn Grow Cashflow hat; bis dahin fertig bauen, Schalter aus |
| Tageslimit | Env-konfigurierbar, Startwert folgt |
| Persona | Fix in V1 (motivierend, ehrlich, darf fordern), Wahl in Stufe 2 |

## 10. Umsetzungsstand

### M1 – erledigt (Branch `claude/ki-mentor-grow-planning-1v4cp9`)

- Migration: `supabase/migrations/20261127120000_mentor_foundation.sql`
  - `mentor_conversations`, `mentor_messages`, `mentor_usage_daily`, `mentor_settings`
  - Rein additiv, keine bestehende Tabelle wird verändert.
  - RLS aktiv, **kein** Zugriff für `anon`/`authenticated` (auch kein Lesen); nur `service_role` (Backend).
  - Nachrichten sind über `(conversation_id, user_id)` an eine Konversation desselben Users gebunden.
  - `on delete cascade` von `auth.users` → Account-Löschung entfernt alle Mentor-Daten.
  - Trigger: `updated_at`, `last_message_at` der Konversation.
  - `mentor_memories` und `mentor_actions` folgen mit M6/M7.
- Tests: `apps/api/tests/mentorFoundationMigration.test.ts` (statisch), `apps/api/tests/mentorFoundationMigration.integration.test.ts` (Postgres: Rechte, Ownership-FK, Constraints, Trigger, Cascade).
- **Nicht** auf die echte Supabase-Datenbank angewendet. Die laufende Beta ist unberührt; es gibt noch keine neuen API-Routen.

Integrationstests lokal:

```bash
docker compose -f docker-compose.test.yml up -d
cd apps/api
TEST_DATABASE_URL=postgresql://grow_test:grow_test_password@127.0.0.1:55432/grow_api_integration_test \
ALLOW_INTEGRATION_DB_RESET=true npm run test:integration
```

Rollout (erst, wenn M3 fertig ist und das Backend die Tabellen nutzt): Migration zuerst auf einem Staging-/Testprojekt anwenden, danach Production. Da additiv, beeinflusst sie bestehende Builds nicht.

### M2 – erledigt

- Modul `apps/api/src/modules/mentor/`:
  - `provider/mentorProvider.ts` – Provider-Schnittstelle + `MentorProviderError` (unavailable, rate_limited, timeout, invalid_response)
  - `provider/mockMentorProvider.ts` – deterministischer Test-Provider ohne Netzwerk
  - `provider/createMentorProvider.ts` – Auswahl per `MENTOR_PROVIDER` (aktuell nur `mock`)
  - `mentorPrompt.ts` – versionierter System-Prompt (`mentor-v1.1`): Persona, begründetes Festhalten an eigener Position statt Einknicken, Themen, Out-of-Scope, Safety, Datum/Zeitzone
  - `mentorSafety.ts` – deterministisches Krisen-Sicherheitsnetz (fügt Hilfsangebote garantiert an)
  - `mentorSchemas.ts` – Zod: Nachricht 1–4000 Zeichen, keine Steuerzeichen, `strict()` (keine fremden Felder wie `userId`)
  - `mentorReplyEngine.ts` – baut Prompt, begrenzt History, Timeout + Abort, mappt Fehler auf `AppError` (502/503/504), loggt nur Metadaten, nie Inhalte
- Neue Env-Variablen (alle mit sicheren Defaults): `MENTOR_PROVIDER`, `MENTOR_PROVIDER_TIMEOUT_MS`, `MENTOR_MAX_OUTPUT_TOKENS`, `MENTOR_HISTORY_MESSAGES`
- Tests: `apps/api/tests/mentorReplyEngine.test.ts`
- Weiterhin keine Routen registriert → laufendes Backend unverändert.

### M3 – erledigt

- Feature-Flag `MENTOR_ENABLED` (Default `false`): Ohne Flag werden die Mentor-Routen gar nicht registriert → laufende Beta unverändert, auch wenn der Stand deployt wird.
- Routen unter `/v1/mentor/...`: Settings, Einwilligung (geben/zurückziehen), Nutzung, Chatliste, Nachrichten (paginiert), umbenennen, löschen, Nachricht senden. Details: `apps/api/README.md`.
- Einwilligung wird **serverseitig** erzwungen (`403 MENTOR_CONSENT_REQUIRED`), versioniert (`v1`).
- Tageslimit atomar in der DB (`MENTOR_DAILY_MESSAGE_LIMIT`, vorläufig 30, Zeitzone `MENTOR_QUOTA_TIME_ZONE`), plus Kurzzeit-Limit pro Minute (`MENTOR_BURST_LIMIT_PER_MINUTE`, 6).
- Fehlgeschlagene Antworten kosten kein Kontingent und speichern nichts; neuer Chat entsteht erst nach erfolgreicher Antwort.
- Chat-Titel vorerst aus der ersten Nachricht abgeleitet (KI-Titel später mit echtem Provider).
- Fremde Chats liefern immer `404` (keine Information, ob es sie gibt).
- Tests: `apps/api/tests/mentor.test.ts` (Routen/Service), `apps/api/tests/mentorRepository.integration.test.ts` (Postgres, inkl. Parallelitäts-Test fürs Tageslimit).

Aktivierung (später, nach Freigabe): Migration auf Staging anwenden → `MENTOR_ENABLED=true` nur auf Staging → testen → danach Production.

### M5 – erledigt (vor M4 gezogen, läuft gegen den Mock-Provider)

- Client-Feature-Flag `EXPO_PUBLIC_MENTOR_API_ENABLED` (Default aus). Aus **oder** Backend antwortet `404 NOT_FOUND` → exakt der bisherige Platzhalter (`features/mentor/components/MentorPlaceholder.jsx`). `eas.json` wurde nicht geändert → OTA-Updates verändern die Beta nicht.
- `features/mentor/services/mentorApi.js` (nutzt `requestProfileV1`), `mentorNormalizers.js` (+ `mentorNormalizers.test.cjs`)
- `MentorScreen`: Laden → Einwilligung → Chatliste (neuer Chat, Umbenennen/Löschen per Long-Press oder „…“, Tageskontingent)
- `MentorChatScreen` (Route `/tools/mentor-chat`): Starter-Fragen, Nachrichten (invertierte Liste, ältere nachladen), „Mentor denkt nach…“, Fehlerbanner mit „Nochmal“, Tageslimit-Hinweis inkl. Uhrzeit, Text bleibt bei Fehler erhalten, KI-Hinweis
- Kleine additive Änderung: `ProfileApiError` reicht jetzt `details` aus Fehlerantworten durch (für Limit-Uhrzeit).
- Geprüft: Node-Tests, iOS-Bundle (`expo export`), Ende-zu-Ende gegen lokales Backend + Postgres + Mock.
- **Noch nicht geprüft:** Darstellung auf echten Geräten (Tastatur, Tab-Bar-Abstand, kleine iPhones, Android).

Lokal testen: Backend mit `MENTOR_ENABLED=true` + `DATABASE_URL` (Migration angewendet) starten, App mit `EXPO_PUBLIC_MENTOR_API_ENABLED=true` und `EXPO_PUBLIC_API_URL=<lokales Backend>`.

### Gefunden, separates Ticket (nicht Mentor)

- `apps/api/src/errors/errorHandler.ts` mappt alle Fastify-Clientfehler (z. B. leerer JSON-Body, ungültiges JSON) auf `500 INTERNAL_ERROR` statt `400`. Betrifft alle Routen. Vorschlag: `FastifyError` mit `statusCode` 4xx als `400 BAD_REQUEST` zurückgeben.

### M4 – erledigt (Code fertig, **nicht scharf geschaltet**)

- `provider/anthropicMentorProvider.ts`: offizielles SDK `@anthropic-ai/sdk`, Modell `claude-sonnet-5-5`, Effort `low` (per Env änderbar), Prompt-Caching, serverseitiger Fallback bei Ablehnungen (`fallbacks: "default"`), Abbruch per Timeout-Signal, Fehler-Mapping (Rate Limit, Timeout, kein Guthaben/Key ungültig → „nicht erreichbar“), höfliche Antwort bei Ablehnung.
- Aktivierung nur mit `MENTOR_PROVIDER=anthropic` **und** `ANTHROPIC_API_KEY`; ohne Key startet das Backend in diesem Modus gar nicht. Default bleibt `mock`.
- Key wird in Logs geschwärzt und existiert nur im Backend.
- Testgespräche: `apps/api/evals/mentor/cases.json` (12 Fälle: Position halten, bessere Argumente annehmen, Off-Topic, Allgemeinwissen, Verletzung, Krise, Business, Bücher, Prompt-Injection, Anlageberatung, Englisch, Motivation) + `npm run eval:mentor` → Markdown-Bericht zur manuellen Bewertung.
- Tests: `apps/api/tests/anthropicMentorProvider.test.ts` (Parameter, Text-Extraktion, Tokens, Ablehnung, Fehler-Mapping, kein Durchsickern von Anbieter-Details).
- **Nicht** gegen die echte API getestet (kein Konto/Guthaben). Erster echter Test = erster Eval-Lauf nach Freigabe.

Scharf schalten (später): Anthropic-Konto + AVV → Key als Server-Secret im Backend hinterlegen → Eval-Lauf auf Staging bewerten → `MENTOR_PROVIDER=anthropic` + `MENTOR_ENABLED=true` auf Staging → danach Production.

### M6 – erledigt

- Migration `supabase/migrations/20261127130000_mentor_memories.sql`: `mentor_memories` (Kategorie, Inhalt ≤ 300 Zeichen, Status `active`/`resolved`, Quelle), RLS ohne Client-Zugriff, Cascade bei Account-Löschung. Additiv, nicht angewendet.
- Extraktion nach jeder Antwort im Hintergrund (verzögert die Antwort nicht): Claude Haiku 5.5 mit strukturierter JSON-Ausgabe; im Mock-Modus nur Nachrichten, die mit „Merke dir:“ beginnen. Ausgabe wird einzeln geprüft (fremde IDs, ungültige Kategorien, zu lang → verworfen), max. 3 Änderungen pro Nachricht, max. 100 aktive Einträge (`MENTOR_MEMORY_MAX_ACTIVE`). Fehler brechen den Chat nie.
- Keine Speicherung aus Krisen-Nachrichten; keine Passwörter, Bank-/Adressdaten oder Daten über Dritte (Extraktions-Prompt).
- „Vergangen“-Einträge bleiben erhalten (z. B. verheilte Verletzung), damit der Mentor später Zusammenhänge erkennt.
- Prompt `mentor-v1.2`: bis zu 80 Einträge als Daten (nicht Anweisungen) im System-Prompt; Anweisung, Zusammenhänge aktiv herzustellen.
- API: `PATCH /v1/mentor/settings` (Gedächtnis an/aus), `GET/PATCH/DELETE /v1/mentor/memories[/:id]`.
- App: Screen „Was der Mentor weiß“ (Glühbirne oben rechts in der Chatliste): nach Kategorie gruppiert, Bearbeiten, als vergangen/aktuell markieren, Löschen, „Alles vergessen“, Schalter Gedächtnis an/aus.
- Tests: Backend-Unit (Extraktion, Bereinigung, Prompt, Routen, Ownership, Limit, Krise, Fehler), Postgres-Integration (Ownership, Constraints, Rechte, Cascade, Quelle `set null`), App-Normalizer, iOS-Bundle, Ende-zu-Ende lokal.
- **Noch offen:** Qualität der echten Extraktion (erst mit Anthropic-Key prüfbar) und Darstellung auf echten Geräten.

### M7 – erledigt

- Migration `supabase/migrations/20261127140000_mentor_actions.sql`: `mentor_actions` als Vorschlags- und Protokoll-Tabelle (Status `proposed` → `executing` → `executed`/`failed`, oder `rejected`/`expired`), RLS ohne Client-Zugriff, Cascade bei Account-Löschung, Protokoll bleibt beim Löschen eines Chats erhalten. Additiv, nicht angewendet.
- Registry (`modules/mentor/actions/mentorActionRegistry.ts`): jedes Tool meldet `read`- oder `write`-Aktionen mit Zod-Schema, JSON-Schema für die KI, deutschem Kartentext und `execute(userId, input)` an. **In Production noch leer** – M8–M10 docken hier an.
- KI ruft Aktionen als Tools auf (Tool-Schleife im Provider, max. 3 Runden; Denk-Blöcke werden unverändert zurückgegeben). `read` läuft sofort für den eingeloggten User, `write` wird **nur** als Vorschlag gespeichert (max. 3 pro Antwort). Ungültige oder unbekannte Aufrufe werden verworfen.
- Bestätigen/Ablehnen: `POST /v1/mentor/actions/:id/confirm|reject`. Ausführung genau einmal (auch bei gleichzeitigem Tippen), Eingabe wird vor Ausführung erneut geprüft, Vorschläge laufen nach 7 Tagen ab, Fehler werden als `failed` mit Code protokolliert.
- Der Mentor sieht im Verlauf, was aus seinen Vorschlägen wurde (Prompt `mentor-v1.3`: nie behaupten, etwas sei erledigt).
- App: Vorschlagskarte unter der Mentor-Nachricht mit „Bestätigen“/„Ablehnen“ und Status (Erledigt, Abgelehnt, Hat nicht geklappt, Abgelaufen).
- Testmodus: `/aktion <tool_name> <json>` löst lokal einen Tool-Aufruf aus.
- Tests: Unit (Registry, Tool-Schleife, Vorschläge, Limits, Ownership, Doppel-Bestätigung, Ablauf, Fehler), Postgres (gleichzeitiges Bestätigen, Ownership, Ablauf, Constraints, Rechte, Cascade), App-Normalizer, iOS-Bundle, Ende-zu-Ende mit Demo-Aktion.

### M8 – erledigt (Habits, Todos)

- `modules/mentor/tools/` mit `habitActions.ts`, `todoActions.ts`, `defaultRegistry.ts` (in Production registriert).
- Habits: `habits.list` (lesen: Tage, heute erledigt, Erledigungen der letzten 28 Tage), `habit.create`, `habit.update` (Name/Tage; Collections behalten ihre Tage), `habit.complete` (heute/gestern, doppelt abhaken unmöglich).
- Todos: `todos.list` (offene zuerst), `todo.create` (optional Fälligkeit), `todo.update` (Titel/Fälligkeit, Fälligkeit entfernen), `todo.complete` (bestehender Completion-Trigger zählt weiter).
- Kein Löschen durch den Mentor. Jede Abfrage ist an die User-ID aus dem Login gebunden; fremde IDs → „nicht gefunden“, schon beim Vorschlag.
- Kartentexte mit echten Namen, Wochentagen und Datum in der Zeitzone `MENTOR_QUOTA_TIME_ZONE`; doppelte Gewohnheitsnamen werden abgelehnt.
- Die App schreibt Habits/Todos weiterhin direkt; die Mentor-Wege sind zusätzlich (keine Änderung bestehender Mobile-Logik).
- Tests: Postgres-Integration (`tests/mentorTools.integration.test.ts`: Ausführung, Ownership, Zeitzone, Validierung, Completion-Trigger), Ende-zu-Ende lokal.
- **Training zurückgestellt:** Die Trainings-Tabellen sind nicht als Migration im Repo und Joshua erklärt den Trainingsplan noch. Danach folgt M8b.
