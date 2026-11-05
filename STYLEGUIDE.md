# Styleguide: Grafik und Texturen

Die Spielhalle sieht aus wie ein Siebdruck auf Papier: wenige kräftige Farben, leichter Druckversatz, Rasterpunkte statt Verläufe. Diese Regeln gelten für die Startseite und für jedes Spiel.

## 1. Farben

Nur die Tokens aus `shared/style.css` verwenden, im Canvas über `Shell.palette()`.

| Token | Hell | Dunkel | Einsatz |
| --- | --- | --- | --- |
| `--paper` | `#f2ecdf` | `#1b1922` | Grund |
| `--ink` | `#23202c` | `#efe8da` | Konturen, Text |
| `--pink` | `#ff4d8d` | `#ff6a9f` | Spieler, Licht, Druckversatz |
| `--blue` | `#2b62c9` | `#6f97ff` | Wasser, zweite Druckfarbe |
| `--yellow` | `#ffc93c` | `#ffd25e` | Belohnung, Sterne |
| `--green` | `#12a167` | `#3fcf8e` | Erfolg, Wachstum |
| `--orange` | `#ff7a3d` | `#ff905c` | Gefahr, Hitze, Feuer |

Nachtspiele (Echolot, Sternwacht) haben eine eigene, feste Nachtpalette im Spielcode. Sie nutzen dieselbe Logik: dunkler Grund, höchstens drei Leuchtfarben plus Papierweiß.

## 2. Formen und Konturen

- Konturen in Tinte, 1,5 bis 2,5 px, runde Enden und Ecken.
- Jede wichtige Fläche bekommt **Druckversatz**: die Form zuerst in einer zweiten Farbe 2 bis 4 px nach rechts unten, darüber die Hauptfarbe (`Shell.riso`).
- Harte, versetzte Schatten statt weicher Schlagschatten (Karten, Knöpfe: `box-shadow: 5px 5px 0`).

## 3. Schattierung und Texturen

Alle Texturen entstehen im Code (`Shell.tex`), es gibt keine Bilddateien.

- **Rasterpunkte** (`halftoneCircle`, `halftoneRect`) für Schatten und Volumen. Nie weiche Verläufe auf Objekten.
- **Schraffur** (`hatch`) für trockene, raue oder unfertige Flächen.
- **Papierkorn** (`grain`) liegt als letzte Ebene über jedem Frame, im Dunkelmodus halb so stark.
- **Rauschen** (`noiseField`, `nebula`) für Gestein und Weltraumnebel, ausgegeben als Rasterpunkte.
- Teure Flächen (Böden, Spielfelder) werden mit `cached` einmal gezeichnet und wiederverwendet.
- Glühen nur für Licht und Energie (Strahl, Kristalle), als mehrere halbtransparente Linien.

## 4. Schrift

- Titel und große Zahlen: **Fraunces** (weich, gern kursiv für Ausrufe wie „Alles im Licht“).
- Oberfläche, Werte, Hinweise: **IBM Plex Mono**, 11 bis 13 px.
- Anzeigen im Spiel in Großbuchstaben nur bei Nachtspielen (Instrumentenoptik).

## 5. Bewegung

- Auftauchen mit `ease.outBack`, Verschwinden mit `ease.inOut`, Belohnungen mit `ease.outElastic`.
- Nichts springt hart von 0 auf 1: Drehungen, Banner und Zellen werden immer getweent.
- Partikel sind kleine Quadrate (Druckpunkte), keine weichen Kreise.
- Treffer und Fehler: kurzer Bildschirmwackler, nie länger als 0,5 s.

## 6. Ton

- Alle Klänge werden live erzeugt (`Shell.sound`), kurz und leise, mit Stummschalter in jeder Kopfzeile.
- Erfolg steigt in der Tonhöhe, Fehler fällt.

## 7. Illustrationen

- Kartenbilder auf der Startseite sind handgeschriebene SVGs mit höchstens drei Farben plus Tinte.
- Hinter jeder Illustration liegt ein feines Punktraster.

## 8. Fremde Dateien

Es werden keine fremden Grafiken, Schriften oder Klänge eingebunden, außer den Schriften von Google Fonts (SIL Open Font License). Falls später doch fremde Dateien dazukommen, nur mit Lizenz CC0 und mit Eintrag in einer `LICENSES.md`.
