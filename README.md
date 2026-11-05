# Spielhalle

Sieben Browserspiele, live unter **https://games.labtoso.de**.

| Spiel | Worum es geht | Steuerung |
| --- | --- | --- |
| **Umlauf** | Um Planeten kreisen, im richtigen Moment lösen, vom nächsten einfangen lassen. | Tippen, Klicken oder Leertaste |
| **Echolot** | Mit einem U-Boot durch eine dunkle Höhle. Der Ping zeigt die Wände und lockt Minen an. | WASD/Pfeile + Leertaste, oder halten und tippen |
| **Lichtweg** | Spiegel kippen, bis der Lichtstrahl alle Kristalle trifft. | Tippen/Klicken, R setzt zurück |
| **Wolkenhirte** | Als Wind Wolken über trockene Felder treiben, bis alles blüht. | Maus oder Finger |
| **Weichenwerk** | Weichen stellen, damit jedes Paket in der richtigen Rutsche landet. | Tippen/Klicken oder 1–7 |
| **Sternwacht** | Weltraum-Shooter mit Wellen, Wächtern und Bomben. | WASD/Pfeile, Shift, B, oder Finger ziehen |
| **Schlagabtausch** | Ballduell gegen den Computer oder zu zweit. | W/S und ↑/↓, am Handy beide Bildschirmhälften |

Reines HTML, CSS und JavaScript ohne Build-Schritt. Lokal starten:

```sh
python3 -m http.server 8000
```

Rekorde werden nur im `localStorage` des Browsers gespeichert. Grafik und Texturen folgen dem [Styleguide](STYLEGUIDE.md).
