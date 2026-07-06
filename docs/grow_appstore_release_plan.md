# Grow App Store Release Plan

Stand: 30.06.2026  
Ziel: Erster öffentlicher App Store Release von Grow, sodass jeder Mensch die App herunterladen kann.

---

## 0. Grundentscheidung

Grow soll nicht nur als kleine Beta veröffentlicht werden, sondern als erste echte öffentliche Production-Version.

Deshalb gilt:

- Stabilität vor unnötiger Feature-Masse
- Sicherheit vor schneller Umsetzung
- Backend-Logik nicht mehr blind im Client verteilen
- KI Mentor ist Pflichtfeature für Release
- Creator Upload kommt kontrolliert, nicht offen für alle
- Werbung/Affiliate wird vorbereitet, aber erst nach öffentlichem Release aktiviert
- Community/Chats sind Wunschfeatures und werden geschnitten, falls der Aufwand zu groß wird

---

## 1. Release-Schnitt festlegen

### Muss vor Release

- Backend-Fundament
- Supabase/Database Security Check
- Profilsystem V1
- KI Mentor V1
- Creator-System V1
- Video-Upload V1
- KI-Empfehlung + manuelle Video-Freigabe
- Admin/CEO Dashboard für Moderation
- Feed stabilisieren
- App Store Pflichtkram
- Finales Testing

### Sollte vor Release

- Bestehende Tools vertiefen
- Kalorientracker V1, wenn realistisch
- Werbung/Affiliate technisch vorbereiten
- Challenges/Rangliste als Community V1, wenn realistisch

### Kann falls Zeit ist vor Release

- Private Chats
- Videos in Chats senden
- automatische Video-Freigabe
- große Community-Funktionen
- Werbung/Affiliate aktivieren
- mehr Tools

---

## 2. Backend-Architektur

Ziel: eigenes Backend als saubere Grenze zwischen App und Datenbank.

### Aufgaben

- Backend-Technologie festlegen
- Projektstruktur definieren:
  - Routes / Controllers
  - Services
  - Repositories
  - Validation
  - Middleware
  - Error Handling
  - Logging
- Supabase-Zugriffe aus kritischen Client-Flows ins Backend ziehen
- API-Konvention festlegen
- Environment Variables sauber trennen
- API Keys niemals im Client speichern

### Kritische Bereiche zuerst ins Backend

- Auth/Profile-Zugriffe
- Creator-Anfragen
- Creator-Freischaltung
- Video-Upload
- Video-Moderation
- KI Mentor
- Admin/CEO-Funktionen
- spätere Ads/Affiliate-Schalter

---

## 3. Supabase & Database absichern

Ziel: echte Sicherheit darf nicht nur aus Client-Checks bestehen.

### Aufgaben

- RLS für jede Tabelle prüfen
- Policies für Lesen/Schreiben/Löschen prüfen
- User dürfen nur eigene Daten ändern
- Admin-Operationen serverseitig absichern
- Storage-Buckets absichern
- Fremde IDs in Updates/Deletes verhindern
- Rollenmodell prüfen
- Foreign Keys prüfen
- Unique Constraints prüfen
- Check Constraints für Rollen, Kategorien und Statuswerte prüfen
- Default-Werte und Pflichtfelder prüfen

---

## 4. Zentrale Validation

Ziel: alle Eingaben zentral und serverseitig prüfen.

### Aufgaben

- Validation-Library festlegen, z. B. Zod
- Schema für Profile
- Schema für Usernames
- Schema für Feedback
- Schema für Creator-Anträge
- Schema für Video Uploads
- Schema für KI Mentor Nachrichten
- maximale Textlängen definieren
- erlaubte Zeichen definieren
- Upload-Limits definieren
- einheitliche Fehlermeldungen definieren
- Schutz gegen Spam und überlange Payloads

---

## 5. Datenmodell sauber machen

### Kernmodelle

- users / auth users
- profiles
- user_settings
- creators
- creator_applications
- videos
- video_moderation
- video_ai_reviews
- mentor_chats
- mentor_messages
- tools
- tool_progress
- challenges
- challenge_participants
- admin_actions
- analytics_events

### Wichtige Statuswerte

Videos:

- pending
- approved
- rejected
- needs_review

Creator:

- none
- requested
- approved
- rejected
- suspended

---

## 6. Profilsystem V1

Ziel: jeder User hat ein echtes Profil und eigene Einstellungen.

### Funktionen

- Profilname
- Username
- Profilbild
- Bio optional
- Ziele/Interessen optional
- Einstellungen
- Datenschutzoptionen
- Account löschen
- Logout

### Sicherheit

- Username eindeutig
- Username-Zeichen begrenzen
- maximale Längen
- Profilbild Upload begrenzen
- User darf nur eigenes Profil ändern

---

## 7. KI Mentor V1

Ziel: KI Mentor ist das zentrale Release-Pflichtfeature.

### Funktionen

- Chat mit KI Mentor
- Backend-seitige KI-Anbindung
- optional gespeicherte Chat-History
- grober User-Kontext möglich
- klare Safety-Grenzen
- Rate Limits
- Fehlerbehandlung
- Loading States

### Regeln

- Kein API Key im Client
- Kein unkontrollierter direkter KI-Zugriff aus der App
- keine medizinischen/rechtlichen/finanziellen Versprechen
- Missbrauch und Spam begrenzen

---

## 8. Creator-System V1

Ziel: Upload nicht für alle öffnen, sondern kontrolliert über Creator-Zugang.

### Funktionen

- User kann Creator-Zugang beantragen
- Antrag enthält kurze Infos/Motivation
- Admin sieht Creator-Anträge
- Admin kann freischalten oder ablehnen
- nur freigeschaltete Creator dürfen Videos hochladen
- Creator kann ggf. gesperrt werden

---

## 9. Video-Upload V1

Ziel: Creator können Videos hochladen, aber nichts geht ungeprüft live.

### Funktionen

- Upload nur für freigeschaltete Creator
- Video landet immer auf pending
- technische Prüfung:
  - Dateityp
  - Größe
  - Länge
  - Format
- Upload-Fortschritt anzeigen
- Fehler sauber anzeigen
- Storage-Regeln absichern

---

## 10. Video-Prüfung V1

Ziel: KI gibt Empfehlung, Mensch entscheidet final.

### Ablauf

1. Creator lädt Video hoch
2. Video bekommt Status pending
3. KI prüft Video/Inhalt soweit möglich
4. KI gibt Empfehlung:
   - passend
   - kritisch
   - ablehnen
   - manuelle Prüfung nötig
5. Admin sieht Empfehlung
6. Admin entscheidet final:
   - approve
   - reject
   - needs_review

### Wichtig

- keine automatische Freigabe zum Start
- Moderationsentscheidung protokollieren
- Ablehnungsgrund optional speichern

---

## 11. Admin/CEO Dashboard umbauen

Ziel: Dashboard wird echtes Kontrollzentrum.

### Funktionen

- Creator-Anträge anzeigen
- Creator freischalten/ablehnen/sperren
- hochgeladene Videos prüfen
- KI-Empfehlung sehen
- Video freigeben/ablehnen
- User/Rollen verwalten
- wichtige Analytics sehen
- Admin-Aktionen protokollieren

---

## 12. Feed stabilisieren

Ziel: öffentlicher Release braucht einen sauberen Feed.

### Aufgaben

- Performance prüfen
- Video-Ladeverhalten prüfen
- Audio-Verhalten prüfen
- schnelles Scrollen prüfen
- Fehlerfälle behandeln
- leere States
- langsame Verbindung
- App-Wechsel / Pause / Resume
- keine kaputten Videos anzeigen

---

## 13. Bestehende Tools vertiefen

Ziel: lieber wenige Tools richtig gut als viele halbgar.

### Priorität

1. Training
2. Habits / Todo
3. Affirmationen
4. Feedback
5. Journal

### Aufgaben

- UI finalisieren
- Logik stabilisieren
- Daten speichern
- leere States
- Fehlerfälle
- kleine Verbesserungen für echten Nutzen

---

## 14. Neues Tool: Kalorientracker V1

Status: Wunschfeature, nur wenn zeitlich realistisch.

### V1-Idee

- Kalorienziel festlegen
- Mahlzeiten eintragen
- Tagesübersicht
- Protein optional
- einfache Historie

### Wichtig

- Nicht zu groß bauen
- Keine medizinischen Versprechen
- lieber simple V1 als komplexer Tracker

---

## 15. Werbung & Affiliate vorbereiten

Ziel: technisch vorbereitet, aber nicht vor Release aggressiv aktivieren.

### Aufgaben

- Feature Flags einbauen
- Ad-Slots im Feed vorbereiten
- Affiliate-Link-Struktur vorbereiten
- Admin-Schalter vorbereiten
- Datenschutz berücksichtigen
- Tracking-Konzept vorbereiten

### Aktivierung

- erst nach öffentlichem Release
- nur kontrolliert
- UX nicht zerstören

---

## 16. Community V1

Status: Wunschfeature, falls realistisch.

### Vor Release möglich

- Challenges
- Rangliste
- einfache Teilnahme
- Punkte/Status sichtbar

### Eher nach Release

- private Chats
- Gruppen-Chats
- Videos in Chats senden
- Meldesystem für Nachrichten
- Blockieren von Usern
- große Moderation

---

## 17. Testing-Struktur

Ziel: nicht nur manuell testen, sondern wichtige Bereiche absichern.

### Aufgaben

- Unit Tests für wichtige Funktionen
- Backend Tests
- API Tests
- Validation Tests
- Auth/Profile Tests
- Creator Upload Tests
- KI Mentor Tests
- Video-Freigabe Tests
- kritische App-Flows manuell auf echten Geräten testen

---

## 18. Security & Performance Check

### Security

- RLS final prüfen
- Policies final prüfen
- Storage final prüfen
- Rate Limits
- Upload-Missbrauch verhindern
- Admin-Zugriffe serverseitig erzwingen
- keine Secrets im Client

### Performance

- Pagination
- kein unnötiges select('*')
- Indexes prüfen:
  - user_id
  - video_id
  - created_at
  - is_active
  - role
  - tool_id
- Admin/Analytics langfristig über Views, RPCs oder Backend aggregieren

---

## 19. Rechtliches & App Store Pflicht

### Muss

- Datenschutz
- Nutzungsbedingungen
- Impressum
- Support-Kontakt
- Account löschen
- Melden/Blockieren, sobald UGC/Community relevant ist
- Moderationsprozess erklären
- Altersfreigabe prüfen
- KI-Hinweise prüfen

---

## 20. Finaler Beta/TestFlight Durchlauf

### Testbereiche

- Onboarding
- Login/Signup
- Feed
- Rating
- Feedback
- Tools
- KI Mentor
- Profil
- Creator-Antrag
- Video-Upload
- Admin-Freigabe
- Push/OTA Verhalten
- App-Wechsel
- schwache Verbindung
- echte iPhones verschiedener Größen

---

## 21. App Store Material

### Aufgaben

- App Name final
- Beschreibung
- Keywords
- Kategorie
- Screenshots
- App Preview optional
- Altersfreigabe
- Review Notes
- Datenschutzangaben im App Store Connect
- Support URL
- Marketing URL optional

---

## 22. Release Candidate

Ziel: ab hier keine riskanten Feature-Änderungen mehr.

### Aufgaben

- finaler Production Build
- Version/Build Number setzen
- EAS Build
- finale Smoke Tests
- nur noch Bugfixes
- keine großen UI-/Architekturänderungen mehr

---

## 23. App Store Einreichung

### Ablauf

- Build auswählen
- Metadaten prüfen
- Datenschutzangaben prüfen
- Review Notes prüfen
- Einreichen
- Rückfragen von Apple beantworten
- nach Approval kontrolliert veröffentlichen

---

## 24. Nach Release

### Geplante Erweiterungen

- Werbung aktivieren
- Affiliate aktivieren
- private Chats
- Videos in Chats senden
- automatische Video-Freigabe
- größere Community
- mehr Tools
- KI Mentor tiefer personalisieren
- Creator-System ausbauen
- Analytics verbessern

---

## Aktueller Arbeitsmodus für neue Chats

Wenn diese Datei in einen neuen Chat geschickt wird, gilt:

1. Nicht den kompletten Plan neu erfinden.
2. Erst fragen oder prüfen, an welchem Punkt wir gerade stehen.
3. Den nächsten sinnvollen Schritt aus dem Plan ableiten.
4. Features in Muss / Sollte / Nach Release einordnen.
5. Risiken klar benennen.
6. Keine riesigen Nachrichten schreiben.
7. Den User beim strukturierten Abarbeiten unterstützen.

---

## Merksatz

Grow 1.0 soll nicht alles können, sondern öffentlich stabil, sicher und stark genug sein.  
KI Mentor ist Pflicht.  
Creator Upload kommt kontrolliert.  
Community und Monetarisierung werden vorbereitet, aber notfalls nach Release größer gemacht.
