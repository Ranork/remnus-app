import type { SampleText } from '../types';

const text: SampleText = {
  workspaceName: (userName) => `Arbeitsbereich von ${userName}`,
  personalWorkspace: 'Persönlicher Arbeitsbereich',
  demoWorkspace: 'Demo-Arbeitsbereich',
  demoUserName: 'Demo-Nutzer',
  agentTokenName: 'Claude KI-Agent',

  startHere: {
    title: 'Hier starten',
    content: `### Hallo zusammen!

Um zu zeigen, wie **Remnus uns hilft**, beim Entwickeln mit KI-Agenten den Überblick über ein Projekt zu behalten, baue ich als *Beispielprojekt einen einfachen Klon von Microsoft Paint*.

Alles, was Sie hier sehen, haben *Claude Code* und *Remnus* Seite an Seite zusammengestellt!

<div data-yt-id="OVi9pjY_p84"></div>

**Sehen Sie sich das Video an, um zu erfahren, wie dieser Arbeitsbereich entstanden ist!**

<div data-callout-icon="⚡" data-callout-color="blue" data-callout-text="Jede Zeile im Sprint-Board mit einem Agenten-Badge hat ein echter KI-Agent über MCP geschrieben. Öffnen Sie das Panel KI-Agenten (unten links), um das Live-Aktivitätsprotokoll zu sehen."></div>

### Was der KI-Agent tatsächlich gemacht hat

Hier ist der Verlauf der echten Sitzung, die diesen Arbeitsbereich aufgebaut hat, direkt aus dem Agenten-Audit-Log von Remnus:

| Wann | Aktion | Was passiert ist |
|------|--------|------------------|
| Verbunden | \`list_workspace\` | Der Agent hat den Arbeitsbereich durchsucht, um sich zu orientieren |
| Planung | \`create_page\` | Er hat die **Produktspezifikation** für den Paint-Klon entworfen |
| Einrichtung | \`create_database\` | Er hat aus der Spezifikation das **Sprint-Board** erstellt |
| Backlog | \`create_page\` ×16 | Er hat jede Aufgabe mit eigenen Akzeptanzkriterien erzeugt |
| Umsetzung | \`update_page\` | Er hat die Aufgaben *Grundgerüst*, *Pinsel* und *Radierer* auf **Erledigt** gesetzt, sobald sie fertig waren |
| Prüfung | \`query_database\` | Er hat das Board erneut gelesen, um die nächste Aufgabe zu wählen |
| Läuft | \`update_page\` | Er hat das *Linienwerkzeug* auf **In Arbeit** verschoben |

Möchten Sie die ganze Geschichte schriftlich? Öffnen Sie die Seite unten 👇

{{HOW_BUILT_CB}}
`,
  },

  howBuilt: {
    title: 'So ist das entstanden',
    content: `Dieser Arbeitsbereich wurde nicht von Hand befüllt. Ein KI-Agent (**Claude Code**) hat sich über **MCP** mit Remnus verbunden und alles selbst aufgebaut: die Spezifikation, das Aufgaben-Board und die Fortschrittsverfolgung, während ein Mensch alles in Echtzeit mitverfolgt hat.

Diese Seite ist das schriftliche Gegenstück zum Video auf **Hier starten**: dieselbe Geschichte, nur in Ihrem eigenen Tempo zu lesen.

## Der Ablauf

1. **Verbinden:** Der Agent hat sich mit einem MCP-Token an diesem Arbeitsbereich angemeldet und \`list_workspace\` aufgerufen, um zu sehen, was schon da war.
2. **Planen:** Er hat eine **Produktspezifikation** für einen Paint-Klon im Browser geschrieben (Sie können sie in der Seitenleiste öffnen).
3. **Aufteilen:** Aus dieser Spezifikation hat er die Datenbank **Sprint-Board** erstellt und **16 Aufgaben** erzeugt, jede mit eigenen Akzeptanzkriterien und Notizen.
4. **Umsetzen und verfolgen:** Während er Funktionen umsetzte, hat er die Aufgaben über das Board bewegt (\`Backlog → In Arbeit → Erledigt\`) und sein tatsächliches Ergebnis in die Seite jeder Aufgabe zurückgeschrieben.
5. **Synchron bleiben:** Ein Mensch kann jederzeit einsteigen und alles bearbeiten; der Agent sieht den neuen Stand bei seiner nächsten Abfrage. Kein Kopieren und Einfügen, kein verlorener Kontext.

## So lesen Sie die Signale

Remnus macht die Arbeit des Agenten **sichtbar und nachprüfbar**. Das ist der Teil, den andere Werkzeuge nicht zeigen:

<div data-callout-icon="⚡" data-callout-color="blue" data-callout-text="Das Agenten-Badge an einer Zeile bedeutet, dass ein KI-Agent sie zuletzt bearbeitet hat. Fahren Sie mit der Maus darüber, um zu sehen, welches Token die Änderung wann gemacht hat."></div>

- **Das ⚡-Agenten-Badge:** Jede Zeile im Sprint-Board, die ein Agent angefasst hat, ist markiert. Sie wissen immer, was ein Mensch und was eine Maschine geschrieben hat.
- **Das Panel KI-Agenten:** Klicken Sie unten links in der Seitenleiste auf **KI-Agenten**. Dort sehen Sie jedes Token, seinen Umfang und ein Live-Protokoll der letzten Tool-Aufrufe (\`create_page\`, \`update_page\`, \`query_database\`…).

## Probieren Sie es selbst

Sie können Ihren eigenen KI-Agenten in weniger als einer Minute mit Ihrem eigenen Arbeitsbereich verbinden:

1. Öffnen Sie **Arbeitsbereichseinstellungen → MCP** und erstellen Sie ein MCP-Token (Lese- oder Schreibzugriff).
2. Fügen Sie Remnus in Ihrem Client (Cursor, VS Code oder Claude) als MCP-Server hinzu. Endpunkt und Auth-Header werden direkt nach dem Erstellen des Tokens angezeigt, und es gibt auch Schaltflächen zur Installation mit einem Klick.
3. Bitten Sie Ihren Agenten, ein Projekt zu planen, eine Datenbank zu füllen oder eine Seite zusammenzufassen. Jede seiner Aktionen erscheint im Audit-Log, markiert und umkehrbar.

<div data-callout-icon="🔒" data-callout-color="green" data-callout-text="Sie behalten die Kontrolle: Tokens haben einen festen Umfang, jeder Schreibvorgang wird protokolliert und Sie können den Zugriff jederzeit widerrufen."></div>

Das ist die ganze Idee hinter Remnus. Ihre KI-Agenten bekommen einen echten Arbeitsbereich, und Sie behalten den vollen Überblick über alles, was sie tun.
`,
  },

  productSpec: {
    title: 'Produktspezifikation',
    content: `# Produktspezifikation: Paint-Klon

Eine schlanke Mal-App, die im Browser läuft. Keine Abhängigkeiten, keine Konten, keine Installation.

## MVP-Funktionen

### Leinwand und Zeichnen

- Freihand-Pinsel / Stift
- Einstellbare Pinselgröße
- Radierer
- Farbeimer (Flächenfüllung)
- Schaltfläche zum Leeren der Leinwand

### Farbe

- Farbwähler (natives \`<input type="color">\`)
- Palette mit vordefinierten Farben
- Vorschau der aktuellen Farbe

### Formen

- Linienwerkzeug
- Rechteckwerkzeug (Umriss + gefüllt)
- Kreis-/Ellipsenwerkzeug (Umriss + gefüllt)

### Datei

- Leinwand als PNG speichern (Download)
- Bilddatei auf die Leinwand laden / öffnen

### Oberfläche

- Werkzeugleiste mit Werkzeugsymbolen
- Tastenkürzel für häufige Werkzeuge (B = Pinsel, E = Radierer, F = Füllen usw.)
- Rückgängig (eine Stufe oder mehrere Schritte über einen Verlaufsstapel)

## Nicht im Umfang (v1)

- Ebenen
- Textwerkzeug
- Speichern in der Cloud
- Zusammenarbeit

`,
  },

  sprintBoard: {
    name: 'Sprint-Board',
    columns: { title: 'Titel', status: 'Status', priority: 'Priorität', category: 'Kategorie' },
    status: { backlog: 'Backlog', inProgress: 'In Arbeit', done: 'Erledigt' },
    priority: { high: 'Hoch', medium: 'Mittel', low: 'Niedrig' },
    category: { canvas: 'Leinwand', color: 'Farbe', shapes: 'Formen', file: 'Datei', ui: 'Oberfläche' },
    views: { board: 'Board', table: 'Tabelle' },
  },

  tasks: {
    scaffold: {
      title: 'Projektgerüst aufsetzen',
      content: `# Projektgerüst aufsetzen

Die HTML/CSS/JS-Grundstruktur für den Paint-Klon anlegen. Keine Frameworks oder Build-Tools, nur einfache Dateien.

## Aufgaben
- [x] \`index.html\` mit \`<canvas>\`-Element und Platzhalter für die Werkzeugleiste anlegen
- [x] \`style.css\` anlegen (Reset, Layout für Seitenleiste + Leinwandbereich, einfaches Theme)
- [x] \`main.js\` anlegen (Einstiegspunkt, Initialisierung des Canvas-Kontexts)
- [x] Prüfen, dass die Leinwand den verfügbaren Bereich ausfüllt und sich korrekt anpasst

## Akzeptanzkriterien
- \`index.html\` im Browser zeigt eine leere Leinwand und eine leere Werkzeugleiste ✅
- Keine Konsolenfehler beim Laden ✅

## Ergebnis

### Angelegte Dateien
- \`index.html\`: Gerüst mit \`<aside id="toolbar">\` + \`<canvas id="canvas">\` in \`<main id="canvas-area">\`
- \`style.css\`: CSS-Reset, Flex-Layout (56px Seitenleiste + Leinwandbereich, der den Rest ausfüllt), weiße Leinwand in dunklem Rahmen
- \`main.js\`: Initialisierung des Canvas-Kontexts, \`resizeCanvas()\`, das den verfügbaren Bereich ausfüllt und die Zeichnung bei Fenstergrößenänderungen über \`getImageData\`/\`putImageData\` erhält

### Notizen
- Die Leinwand richtet sich nach dem verfügbaren Bereich abzüglich 32px Abstand je Achse und wird bei jedem \`window.resize\` neu berechnet
- Bei jeder Größenänderung wird ein weißer Hintergrund gemalt, damit das gespeicherte PNG nie transparent ist
- Die Werkzeugleiste ist ein senkrechtes \`<aside>\`, bereit für die Werkzeugschaltflächen der folgenden Aufgaben
`,
    },
    brush: {
      title: 'Freihand-Pinsel / Stift umsetzen',
      content: `# Freihand-Pinsel / Stift umsetzen

Nutzer sollen mit Maus oder Finger freihändig auf der Leinwand zeichnen können.

## Aufgaben
- [x] Die Ereignisse \`mousedown\`, \`mousemove\` und \`mouseup\` auf der Leinwand verfolgen
- [x] Mit \`ctx.beginPath()\` / \`ctx.lineTo()\` / \`ctx.stroke()\` glatte Linien zeichnen
- [x] Aktuelle Farbe und Pinselgröße auf die Striche anwenden
- [x] Zeichnen verhindern, wenn die Maustaste nicht gedrückt ist

## Akzeptanzkriterien
- Klicken und Ziehen zeichnet einen durchgehenden Strich ✅
- Farbe und Größe des Strichs entsprechen den gewählten Werten ✅
- Loslassen der Maus beendet das Zeichnen ✅

## Ergebnis

### Änderungen an \`main.js\`
- Ein \`state\`-Objekt ergänzt, das \`tool\`, \`color\`, \`size\`, \`isDrawing\`, \`lastX\` und \`lastY\` verfolgt
- \`getPos(e)\`: normalisiert Maus- und Touch-Koordinaten relativ zu den Grenzen der Leinwand
- \`applyBrushStyle()\`: setzt vor jedem Strich \`strokeStyle\`, \`lineWidth\`, \`lineCap\`, \`lineJoin\` und \`globalCompositeOperation\`
- \`onPointerDown\`: merkt sich die Startposition und zeichnet bei einem einzelnen Klick einen Punkt
- \`onPointerMove\`: zeichnet in jedem Frame ein Liniensegment von der letzten zur aktuellen Position
- \`onPointerUp\` / \`mouseleave\`: beendet das Zeichnen
- Touch-Ereignisse (\`touchstart\`, \`touchmove\`, \`touchend\`) neben den Mausereignissen angebunden, mit \`passive: false\`, damit \`preventDefault\` möglich ist
`,
    },
    eraser: {
      title: 'Radierer umsetzen',
      content: `# Radierer umsetzen

Nutzer sollen Teile der Leinwand löschen können, indem sie mit der Hintergrundfarbe zeichnen.

## Aufgaben
- [x] Den Radierer zur Werkzeugleiste hinzufügen
- [x] Bei aktivem Radierer \`ctx.globalCompositeOperation = 'destination-out'\` setzen
- [x] Die aktuelle Pinselgröße als Radiererbreite verwenden
- [x] Beim Wechsel zurück zum Pinsel die Compositing-Operation wiederherstellen

## Akzeptanzkriterien
- Der Radierer entfernt beim Ziehen Gezeichnetes ✅
- Die Radierergröße folgt dem Schieberegler für die Pinselgröße ✅
- Ein Werkzeugwechsel stellt das normale Zeichnen wieder her ✅

## Ergebnis

### Änderungen an \`main.js\`
- \`applyBrushStyle()\` verzweigt jetzt bei \`state.tool === 'eraser'\`: setzt \`globalCompositeOperation = 'destination-out'\` und nutzt einen deckend schwarzen Strich (löscht Pixel im Alphakanal)
- Der Punkt aus \`onPointerDown\` wendet beim Radieren ebenfalls \`destination-out\` an und setzt die Compositing-Operation nach dem Füllen zurück
- Der Radierer teilt \`state.size\` mit dem Pinsel, eine eigene Größe ist nicht nötig
- Der Wechsel zu einem anderen Werkzeug stellt beim nächsten Strich über \`applyBrushStyle()\` automatisch \`source-over\` wieder her
`,
    },
    brushSize: {
      title: 'Einstellbare Pinselgröße umsetzen',
      content: `# Einstellbare Pinselgröße umsetzen

Einen Schieberegler oder ein Eingabefeld für die Breite von Strich und Radierer anbieten.

## Aufgaben
- [ ] \`<input type="range">\` zur Werkzeugleiste hinzufügen (min. 1, max. 64)
- [ ] Den aktuellen Größenwert neben dem Schieberegler anzeigen
- [ ] Die gewählte Größe vor jedem Strich auf \`ctx.lineWidth\` anwenden
- [ ] Standardgröße: 4px

## Akzeptanzkriterien
- Das Bewegen des Schiebereglers ändert die Pinselbreite sofort
- Pinsel und Radierer berücksichtigen beide die aktuelle Größe
`,
    },
    fill: {
      title: 'Flächenfüllung umsetzen (Farbeimer)',
      content: `# Flächenfüllung umsetzen (Farbeimer)

Per Klick eine zusammenhängende Fläche der Leinwand mit der aktuellen Farbe füllen.

## Aufgaben
- [ ] Pixeldaten mit \`ctx.getImageData()\` lesen
- [ ] Einen iterativen BFS/DFS-Füllalgorithmus ab dem angeklickten Pixel umsetzen
- [ ] Die gefüllten Pixel mit \`ctx.putImageData()\` zurückschreiben
- [ ] Eine Toleranzschwelle (z. B. ±15) für geglättete Kanten ergänzen

## Akzeptanzkriterien
- Ein Klick in eine geschlossene Fläche füllt sie mit der aktuellen Farbe
- Die Füllung läuft nicht über harte Kanten hinaus
- Die Leistung ist bei üblichen Leinwandgrößen (≤1920×1080) akzeptabel
`,
    },
    clear: {
      title: 'Schaltfläche zum Leeren der Leinwand umsetzen',
      content: `# Schaltfläche zum Leeren der Leinwand umsetzen

Die gesamte Leinwand auf einen leeren, weißen Zustand zurücksetzen.

## Aufgaben
- [ ] Eine Schaltfläche „Leeren" zur Werkzeugleiste hinzufügen
- [ ] Beim Klick \`ctx.clearRect(0, 0, canvas.width, canvas.height)\` aufrufen und dann weiß füllen
- [ ] Vor dem Leeren einen Schnappschuss im Verlauf ablegen, damit es rückgängig gemacht werden kann

## Akzeptanzkriterien
- Ein Klick auf Leeren entfernt alles Gezeichnete
- Die Aktion lässt sich mit Rückgängig zurücknehmen
`,
    },
    colorPicker: {
      title: 'Farbwähler umsetzen',
      content: `# Farbwähler umsetzen

Nutzer sollen über die native Farbeingabe des Browsers jede beliebige Zeichenfarbe wählen können.

## Aufgaben
- [ ] \`<input type="color">\` zur Werkzeugleiste hinzufügen
- [ ] Die gewählte Farbe in einer globalen Zustandsvariable \`currentColor\` speichern
- [ ] Bei jeder Farbänderung \`ctx.strokeStyle\` und \`ctx.fillStyle\` aktualisieren
- [ ] Standardfarbe: \`#000000\`

## Akzeptanzkriterien
- Das Öffnen des Farbwählers zeigt den Farbwähler des Betriebssystems
- Eine gewählte Farbe wirkt sofort auf folgende Striche und Füllungen
`,
    },
    palette: {
      title: 'Palette mit vordefinierten Farben umsetzen',
      content: `# Palette mit vordefinierten Farben umsetzen

Eine Reihe vordefinierter Farbfelder zur schnellen Auswahl anzeigen.

## Aufgaben
- [ ] Eine Liste mit ~16 klassischen Malfarben festlegen (Schwarz, Weiß, Rot, Grün, Blau, Gelb usw.)
- [ ] Jede als kleines anklickbares \`<div>\`-Farbfeld in der Werkzeugleiste darstellen
- [ ] Beim Klick \`currentColor\` setzen und den Wert des Farbwählers abgleichen
- [ ] Das aktive Farbfeld mit Rahmen oder Ring hervorheben

## Akzeptanzkriterien
- Ein Klick auf ein Farbfeld wechselt die aktive Farbe sofort
- Der Farbwähler zeigt die Farbe des gewählten Felds
- Das aktive Farbfeld ist sichtbar markiert
`,
    },
    line: {
      title: 'Linienwerkzeug umsetzen',
      content: `# Linienwerkzeug umsetzen

Nutzer sollen eine gerade Linie zwischen zwei Punkten zeichnen können.

## Aufgaben
- [ ] Bei \`mousedown\` den Startpunkt merken und einen Schnappschuss der Leinwand speichern
- [ ] Bei \`mousemove\` den Schnappschuss wiederherstellen und eine Vorschaulinie bis zum Cursor zeichnen
- [ ] Bei \`mouseup\` die endgültige Linie auf die Leinwand übernehmen
- [ ] Mit gedrückter Umschalttaste auf 45°-Schritte beschränken

## Akzeptanzkriterien
- Ziehen zeichnet eine gerade Linie mit Live-Vorschau
- Loslassen der Maus übernimmt die Linie dauerhaft
- Die Umschalttaste beschränkt den Winkel
`,
    },
    rect: {
      title: 'Rechteckwerkzeug umsetzen',
      content: `# Rechteckwerkzeug umsetzen

Umrissene oder gefüllte Rechtecke per Klicken und Ziehen zeichnen.

## Aufgaben
- [ ] Bei \`mousedown\` den Ursprung merken und einen Schnappschuss der Leinwand speichern
- [ ] Bei \`mousemove\` den Schnappschuss wiederherstellen und das Vorschaurechteck zeichnen
- [ ] Bei \`mouseup\` das Rechteck übernehmen
- [ ] Über eine Option in der Werkzeugleiste zwischen Umriss (\`ctx.strokeRect\`) und gefüllt (\`ctx.fillRect\`) wechseln
- [ ] Mit gedrückter Umschalttaste auf ein Quadrat beschränken

## Akzeptanzkriterien
- Ziehen zeichnet eine Live-Vorschau des Rechtecks
- Der Wechsel zwischen Umriss und gefüllt funktioniert
- Die Umschalttaste beschränkt auf ein Quadrat
`,
    },
    ellipse: {
      title: 'Kreis-/Ellipsenwerkzeug umsetzen',
      content: `# Kreis-/Ellipsenwerkzeug umsetzen

Umrissene oder gefüllte Ellipsen per Klicken und Ziehen zeichnen.

## Aufgaben
- [ ] Bei \`mousedown\` den Ursprung merken und einen Schnappschuss der Leinwand speichern
- [ ] Bei \`mousemove\` den Schnappschuss wiederherstellen und die Vorschauellipse mit \`ctx.ellipse()\` zeichnen
- [ ] Bei \`mouseup\` die Ellipse übernehmen
- [ ] Den Umriss/gefüllt-Schalter des Rechteckwerkzeugs wiederverwenden
- [ ] Mit gedrückter Umschalttaste auf einen perfekten Kreis beschränken

## Akzeptanzkriterien
- Ziehen zeichnet eine Live-Vorschau der Ellipse
- Der Wechsel zwischen Umriss und gefüllt funktioniert
- Die Umschalttaste beschränkt auf einen Kreis
`,
    },
    save: {
      title: 'Speichern als PNG umsetzen',
      content: `# Speichern als PNG umsetzen

Nutzer sollen die aktuelle Leinwand als PNG-Datei herunterladen können.

## Aufgaben
- [ ] Eine Schaltfläche „Speichern" zur Werkzeugleiste hinzufügen
- [ ] Beim Klick \`canvas.toDataURL('image/png')\` aufrufen
- [ ] Den Download per Code über ein temporäres \`<a download>\`-Element auslösen
- [ ] Standard-Dateiname: \`painting.png\`

## Akzeptanzkriterien
- Ein Klick auf Speichern lädt ein PNG herunter, das der Leinwand entspricht
- Der weiße Hintergrund bleibt erhalten (die Leinwand ist nicht transparent)
`,
    },
    open: {
      title: 'Bild öffnen / laden umsetzen',
      content: `# Bild öffnen / laden umsetzen

Nutzer sollen eine lokale Bilddatei öffnen und auf die Leinwand zeichnen können.

## Aufgaben
- [ ] Eine Schaltfläche „Öffnen" hinzufügen, die ein verstecktes \`<input type="file" accept="image/*">\` auslöst
- [ ] Die gewählte Datei mit \`FileReader.readAsDataURL()\` lesen
- [ ] Das geladene Bild mit \`ctx.drawImage()\` passend skaliert auf die Leinwand zeichnen
- [ ] Vor dem Zeichnen einen Schnappschuss im Verlauf ablegen, damit es rückgängig gemacht werden kann

## Akzeptanzkriterien
- Ein geöffnetes Bild erscheint auf der Leinwand
- Das Bild wird proportional auf die Größe der Leinwand skaliert
- Die Aktion lässt sich rückgängig machen
`,
    },
    undo: {
      title: 'Rückgängig-Verlauf umsetzen',
      content: `# Rückgängig-Verlauf umsetzen

Nutzer sollen schrittweise zu früheren Zuständen der Leinwand zurückkehren können.

## Aufgaben
- [ ] Ein \`history\`-Array mit \`ImageData\`-Schnappschüssen führen (höchstens 50 Einträge)
- [ ] Vor jeder übernommenen Zeichenoperation einen Schnappschuss ablegen
- [ ] Bei Rückgängig (\`Ctrl+Z\`) den letzten Schnappschuss entnehmen und mit \`ctx.putImageData()\` wiederherstellen
- [ ] Eine Rückgängig-Schaltfläche in der Werkzeugleiste für Nutzer ohne Tastatur ergänzen
- [ ] Die Rückgängig-Schaltfläche deaktivieren, wenn der Verlauf leer ist

## Akzeptanzkriterien
- \`Ctrl+Z\` geht jeweils eine Operation zurück
- Bis zu 50 Verlaufsschritte stehen zur Verfügung
- Die Rückgängig-Schaltfläche ist sichtbar deaktiviert, wenn es nichts rückgängig zu machen gibt
`,
    },
    toolbar: {
      title: 'Werkzeugleiste und Werkzeugsymbole umsetzen',
      content: `# Werkzeugleiste und Werkzeugsymbole umsetzen

Die seitliche Werkzeugleiste mit allen Werkzeugschaltflächen und Bedienelementen bauen.

## Aufgaben
- [ ] Eine senkrechte Werkzeugleiste links in CSS gestalten
- [ ] Symbolschaltflächen ergänzen für: Pinsel, Radierer, Füllen, Linie, Rechteck, Ellipse, Öffnen, Speichern, Rückgängig, Leeren
- [ ] Unicode-Zeichen oder einfache SVG-Symbole verwenden (keine externe Symbolbibliothek)
- [ ] Die Schaltfläche des aktiven Werkzeugs mit einem Auswahlstil hervorheben
- [ ] Jeder Schaltfläche einen Tooltip geben (Attribut \`title\`)

## Akzeptanzkriterien
- Alle Werkzeuge sind über die Werkzeugleiste erreichbar
- Das aktive Werkzeug ist deutlich hervorgehoben
- Die Werkzeugleiste ist bei 1080p lesbar und läuft auf kleineren Bildschirmen nicht über
`,
    },
    shortcuts: {
      title: 'Tastenkürzel umsetzen',
      content: `# Tastenkürzel umsetzen

Tastenkürzel für den schnellen Werkzeugwechsel und häufige Aktionen anbinden.

## Übersicht der Tastenkürzel
| Taste | Aktion |
|-------|--------|
| B | Pinsel |
| E | Radierer |
| F | Füllen (Eimer) |
| L | Linie |
| R | Rechteck |
| C | Kreis / Ellipse |
| Ctrl+Z | Rückgängig |
| Ctrl+S | Als PNG speichern |
| Entf | Leinwand leeren |

## Aufgaben
- [ ] Einen \`keydown\`-Listener auf \`document\` hinzufügen
- [ ] Anhand von \`event.key\` zum richtigen Werkzeug oder zur richtigen Aktion verzweigen
- [ ] \`Ctrl+\`-Kombinationen mit \`event.ctrlKey\` / \`event.metaKey\` absichern
- [ ] Keine Tastenkürzel auslösen, wenn der Fokus in einem Eingabefeld liegt

## Akzeptanzkriterien
- Jedes Tastenkürzel aktiviert das richtige Werkzeug oder die richtige Aktion
- Die Tastenkürzel kollidieren nicht mit Browser-Standards (außer Ctrl+S, das bewusst überschrieben wird)
`,
    },
  },
};

export default text;
