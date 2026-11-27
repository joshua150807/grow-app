# KI Mentor – Kostenrechnung KI-Anbieter (für M4)

Stand: 27.11.2026 · Grobe Schätzung, keine Messung. Nach M4 mit echten Token-Zahlen aus `mentor_usage_daily` nachrechnen.

## Preise (USD pro 1 Mio. Tokens)

| Modell | Input | Cache-Read | Output | Quelle |
|---|---|---|---|---|
| Claude Opus 5.5 | 4,00 | 0,20 | 20,00 | Anthropic-Preisliste (Stand 03.11.2026) |
| Claude Sonnet 5.5 | 2,00 | 0,10 | 10,00 | Anthropic-Preisliste (Stand 03.11.2026) |
| Claude Haiku 5.5 | 0,10 | – | 0,50 | Anthropic-Preisliste (Stand 03.11.2026) |
| GPT-5.5 | 5,00 | ~0,50 (angenommen) | 30,00 | Preisvergleichsseite, **unbestätigt** |
| GPT-5 | 1,25 | 0,125 | 10,00 | Preisvergleichsseiten, **unbestätigt** |
| GPT-5 mini | 0,25 | – | 2,00 | Preisvergleichsseite, **unbestätigt** |

Anthropic-Cache-Writes kosten ca. 1,25× Input. OpenAI-Preise vor der Entscheidung auf openai.com prüfen.

## Annahmen pro Mentor-Nachricht (Stand nach M6–M10)

- System-Prompt + Tool-Definitionen (alle Tools) + Memory-Fakten: ca. 8.000 Tokens (stabil → gecacht)
- Verlauf (20 Nachrichten) + neue Nachricht: ca. 4.000 Tokens
- → ca. 12.000 Input-Tokens, davon ca. 75 % Cache-Read, 10 % Cache-Write, 15 % ungecacht
- Antwort inkl. Denken: ca. 1.000 Output-Tokens
- Faktor 1,3 für Tool-Aufrufe (zweiter Durchlauf mit Tool-Ergebnissen)
- Memory-Extraktion/Titel mit Haiku 5.5: ca. 0,04 Cent pro Nachricht (vernachlässigbar)

## Kosten pro Nachricht

| Modell | ca. pro Nachricht |
|---|---|
| Claude Opus 5.5 | 4,6 Cent |
| GPT-5.5 (unbestätigt) | 6,4 Cent |
| Claude Sonnet 5.5 | 2,3 Cent |
| GPT-5 (unbestätigt) | 1,9 Cent |
| GPT-5 mini (unbestätigt) | 0,4 Cent |
| Claude Haiku 5.5 | 0,1 Cent |

## Kosten pro aktivem User und Monat

| Nutzung | Nachrichten/Monat | Opus 5.5 | Sonnet 5.5 | GPT-5.5* | GPT-5* | Haiku 5.5 |
|---|---|---|---|---|---|---|
| Leicht (3/Tag, 20 Tage) | 60 | 2,80 $ | 1,40 $ | 3,80 $ | 1,10 $ | 0,07 $ |
| Normal (10/Tag, 25 Tage) | 250 | 11,50 $ | 5,80 $ | 16,00 $ | 4,80 $ | 0,30 $ |
| Am Limit (30/Tag, 30 Tage) | 900 | 41,00 $ | 21,00 $ | 58,00 $ | 17,00 $ | 1,10 $ |

\* unbestätigte Preise

## Einordnung

- Das Tageslimit ist der wichtigste Kostenhebel: Bei 30/Tag kostet ein Power-User mit Sonnet 5.5 bis ca. 21 $/Monat.
- Haiku/Mini-Modelle sind sehr günstig, aber für Coaching-Qualität, Gedächtnis und zuverlässige Aktionen (Tool Use) über alle Tools voraussichtlich zu schwach → nur für Nebenaufgaben (Memory-Extraktion, Titel).
- Empfehlung: **Hauptmodell Sonnet-Klasse**, Nebenaufgaben mit Haiku. Ein Top-Modell (Opus) nur, wenn eine Testgesprächs-Sammlung (u. a. „bleibt begründet bei seiner Position“, Aktionen korrekt ausgeführt) klar bessere Qualität zeigt.
- Vor der Entscheidung: Auftragsverarbeitungsvertrag (AVV) und Serverstandort/Datenübermittlung beim Anbieter prüfen (Gesundheitsdaten, Art. 9 DSGVO).
- Prompt-Caching ist in der Rechnung eingepreist. Ohne Caching wären die Input-Kosten etwa 3–4× höher.

## Entscheidung (27.11.2026): Claude Sonnet 5.5 + Claude Haiku 5.5

### Kosten pro Nachricht (gleiche Annahmen wie oben)

| Posten | Tokens | Preis / 1 Mio. | Kosten |
|---|---|---|---|
| Sonnet: Input aus Cache (Read) | 11.700 | 0,10 $ | 0,12 Cent |
| Sonnet: Input in Cache schreiben | 1.560 | 2,50 $ | 0,39 Cent |
| Sonnet: Input ungecacht | 2.340 | 2,00 $ | 0,47 Cent |
| Sonnet: Output (Antwort + Denken) | 1.300 | 10,00 $ | 1,30 Cent |
| Haiku: Memory-Extraktion | 3.000 in / 200 out | 0,10 $ / 0,50 $ | 0,04 Cent |
| **Summe pro Nachricht** | | | **ca. 2,3 Cent** |

Output macht gut die Hälfte der Kosten aus → kürzere Antworten und niedrigere Effort-Stufe sind die wirksamsten Stellschrauben (in M4 messen).

### Kosten pro aktivem Mentor-User und Monat

| Nutzertyp | Nutzung | Nachrichten/Monat | Kosten/Monat |
|---|---|---|---|
| Gelegentlich | 1 pro Tag, an 15 Tagen | 15 | ca. 0,35 $ |
| Leicht | 3 pro Tag, an 20 Tagen | 60 | ca. 1,40 $ |
| Normal | 10 pro Tag, an 25 Tagen | 250 | ca. 5,80 $ |
| Intensiv | 15 pro Tag, jeden Tag | 450 | ca. 10,40 $ |
| Am Limit | 30 pro Tag, jeden Tag | 900 | ca. 20,90 $ |

**Gemischter Durchschnitt** (Annahme: 50 % leicht, 35 % normal, 12 % intensiv, 3 % am Limit): **ca. 4,60 $ pro aktivem Mentor-User und Monat.** User, die den Mentor nicht nutzen, kosten nichts.

Unsicherheit: ca. ±50 %, vor allem durch Antwortlänge und Häufigkeit von Tool-Aufrufen. Nach M4 mit echten Zahlen nachrechnen.

### Maximalkosten je Tageslimit (Worst Case pro User/Monat)

| Tageslimit | max. Nachrichten/Monat | max. Kosten/Monat |
|---|---|---|
| 10 | 300 | ca. 7 $ |
| 15 | 450 | ca. 10,40 $ |
| 20 | 600 | ca. 13,90 $ |
| 30 (aktueller Default) | 900 | ca. 20,90 $ |
