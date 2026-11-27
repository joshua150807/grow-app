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
