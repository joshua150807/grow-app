# Grow finaler Beta-Check

Vor dem TestFlight-Build einmal durchgehen:

## App-Flows
- Registrierung mit gültigem Beta-Code
- Registrierung mit ungültigem Beta-Code
- Login
- Logout
- Passwort vergessen / Reset-Link auf iPhone
- Feed 10 Minuten testen
- Video bewerten
- Video speichern / entspeichern
- Feedback ohne Bild senden
- Feedback mit Bild senden
- Training Session starten, Eingaben machen, verlassen, speichern
- Tools Overview öffnen
- Schritt-Tracker öffnen und Motion Permission prüfen
- Admin Dashboard mit Admin/CEO öffnen
- Admin Route mit normalem User testen

## Supabase
- SQL-Schema-Check gibt keine fehlenden Tabellen/Spalten/RPCs zurück
- feedback-images Bucket ist bewusst public für interne Beta
- Beta-Codes vorhanden und ungenutzt
- Admin-/CEO-Rolle beim eigenen Profil gesetzt

## Release
- Für TestFlight: eas build --profile beta --platform ios
- Für OTA Beta: eas update --channel beta --message "..."
- npm run quality vor Build ausführen
- App auf echtem iPhone testen, nicht nur Simulator

## Geparkt bis nach der Beta oder finaler Feinschliff
- Feed Scroll-/Audio-Feinschliff
- Asset-Komprimierung nur vorsichtig einbauen
- Große UI-Refactors erst nach Beta
