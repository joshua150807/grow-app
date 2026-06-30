# Architektur- und Security-Review Notizen

## Kurzeinschaetzung

Die App kann fuer eine Beta funktionieren, ist aber stark auf schnelle Umsetzung optimiert. Fuer Produktion fehlt eine klare Backend-Grenze, in der Validierung, Autorisierung, Businesslogik, Logging und Datenzugriff zentral kontrolliert werden.

Aktuell spricht der Client an vielen Stellen direkt mit Supabase-Tabellen. Das ist nicht automatisch falsch, bedeutet aber: Die eigentliche Sicherheit muss konsequent ueber Supabase RLS, Policies, Constraints, RPCs und Storage-Regeln abgesichert sein.

## Hauptkritikpunkte

- Datenzugriff ist ueber viele Feature-Services verteilt.
- Es gibt keine klassische Backend-Struktur mit Routes, Services, Repositories und zentraler Validation.
- Businesslogik liegt teils im Client, teils in Supabase RPCs, teils in einzelnen Services.
- Direkte Supabase-Zugriffe koppeln den Client stark an Tabellenstruktur und Supabase.
- Clientseitige Checks sind keine echte Sicherheit.
- Admin-Zugriff darf nicht nur clientseitig ueber Rollenpruefung abgesichert sein.

## Validierung

Es gibt punktuelle Checks in Formularen und Services, aber keine systematische Validierungsschicht.

Fehlende bzw. unklare Punkte:

- zentrale Schema-Validation, z. B. Zod, Valibot oder aehnlich
- maximale Laengen fuer User-Eingaben
- erlaubte Zeichen fuer sensible Felder wie Usernames
- serverseitige Typ- und Plausibilitaetspruefung
- einheitliche Fehlerbehandlung
- Schutz vor ueberlangen Payloads, Spam und Storage-Missbrauch

Wichtig: React Native fuehrt Text nicht wie HTML im Browser aus. Trotzdem koennen gespeicherte Eingaben spaeter problematisch werden, z. B. in WebViews, Admin-Dashboards, Markdown/HTML-Renderern, E-Mails oder Exporten.

## Injection

Klassische SQL Injection ist hier vermutlich nicht das groesste Problem, weil Supabase Query Builder genutzt wird und keine rohen SQL-Strings aus User-Input gebaut werden.

Das groessere Risiko liegt bei:

- fehlender serverseitiger Validierung
- fehlenden oder falschen RLS-Policies
- unzureichender Objekt-Autorisierung
- Mass Assignment
- kaputter Datenintegritaet
- Storage- und Upload-Missbrauch

## Autorisierung und RLS

Die zentrale Frage ist nicht, ob der Client prueft, sondern ob die Datenbank es erzwingt.

Fuer jede Tabelle sollte geprueft werden:

- Ist RLS aktiviert?
- Duerfen User nur ihre eigenen Datensaetze lesen?
- Duerfen User nur ihre eigenen Datensaetze schreiben/aendern/loeschen?
- Sind Admin-Operationen serverseitig ueber Rollen abgesichert?
- Kann ein User fremde IDs an Updates oder Deletes uebergeben?
- Sind Storage-Buckets mit passenden Policies geschuetzt?

Clientseitige Admin-Pruefung ist nur UX. Echte Sicherheit muss in Supabase Policies oder in einem eigenen Backend liegen.

## Lost Updates und Race Conditions

Blindes `update()` kann zu Lost Updates fuehren. Wenn zwei Geraete denselben Datensatz bearbeiten, gewinnt meistens der letzte Schreibvorgang.

Moegliche Gegenmassnahmen:

- `updated_at` beim Update pruefen
- `version`-Spalte fuer optimistic concurrency
- kritische Mutationen als RPC/Transaktion
- eindeutige Constraints fuer parallele Inserts
- nach Mutationen gezielt neu laden oder Realtime nutzen

## Performance-Risiken

Moegliche Engpaesse:

- fehlende Pagination bei wachsenden Listen
- haeufiges `select('*')`
- mehrere Roundtrips pro Screen
- clientseitige Aggregation fuer Admin/Analytics
- viele kleine Analytics-Writes
- fehlende Indizes auf haeufig genutzten Spalten

Wichtige Index-Kandidaten:

- `user_id`
- `video_id`
- `created_at`
- `is_active`
- `role`
- `tool_id`
- Foreign Keys wie `plan_id` und `day_id`

Admin-Dashboards und Analytics sollten langfristig eher ueber Views, RPCs oder ein Backend aggregiert werden.

## Datenintegritaet

Fuer Produktion sollten wichtige Regeln nicht nur im Client stehen.

Pruefen:

- Foreign Keys
- Unique Constraints
- Check Constraints fuer Rollen, Kategorien und Statuswerte
- Pflichtfelder und Default-Werte
- Transaktionen fuer zusammenhaengende Operationen, z. B. Training-Plan mit Tagen und Uebungen

