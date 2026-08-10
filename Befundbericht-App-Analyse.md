# Befundbericht: Analyse des BPMN-Editors

> **Bearbeitungsstand 08/2026 — der Grossteil dieser Befunde ist behoben.**
> Erledigt und jeweils per Testlauf bestaetigt: **F-01** (Export ignorierte das
> Stil-Panel), **F-02** (ausgeblendete Elemente im Export), **F-03/F-04**
> (Fuellung wurde Schraffur, Tooltip-Text unsichtbar), **F-05** (linksbuendige
> Labels zentriert), **F-06** (Text-Grundlinien), **F-07/F-08/F-09**
> (BPMN-XML: fehlende Ereignis-Definitionen, ungueltige Pool-Referenzen,
> Throw- statt Catch-Events), **F-12** (Einfuegen stapelte Kopien),
> **F-13** (Strg+D). `npm run check:export` meldet 64 von 64 Shape-Typen im
> Rahmen (zu Beginn der Analyse: 36 von 64).
>
> **Offen:** F-10 (kein Hinweis beim BPMN-Export eines Diagramms ohne
> BPMN-Elemente), F-11 (Verbindungs-Port von der Verschiebe-Trefffläche
> ueberdeckt) sowie zwei Inkonsistenzen: `core/io/imageExport.ts` importiert
> `sketch.ts` aus dem Wireframe-Modul, und das Stil-Panel bleibt bei
> Wireframe-Shapes wirkungslos (auch auf dem Bildschirm).
>
> Der folgende Text ist der urspruengliche Befund und bleibt als Beleg und
> Reproduktionsanleitung unveraendert stehen.

Stand: 2026-08-10
Untersuchungsgegenstand: `index.html` im Wurzelverzeichnis (das ausgelieferte
Einzeldatei-Artefakt; hieß zum Zeitpunkt der Untersuchung `bpmn-editor.html`)
Methode: automatisierte Interaktionstests im echten Browser (Chromium/Playwright),
Vergleich von Bildschirmdarstellung und Exportergebnis, Auswertung der Exportformate.

> Hinweis zur Ausgangslage: Das Quellprojekt `bpmn-editor-source/` liegt nicht im
> Repository. Alle Befunde stammen daher aus dem **Verhalten der laufenden App**, nicht
> aus Quellcode-Lektüre. Jeder Befund ist reproduzierbar beschrieben; die Zuordnung zu
> konkreten Quelldateien ist eine begründete Vermutung und mit „vermutlich" markiert.

## 1. Vorgehen

Die App wurde in einem echten Chromium gestartet und automatisiert bedient. Grundlage
aller Messungen:

- Alle 67 registrierten Shape-Typen (25 BPMN, 41 Wireframe, 1 Text) wurden einzeln
  platziert und exportiert.
- Für jeden Typ wurde die **Bildschirmdarstellung pixelgenau gegen den SVG-Export**
  verglichen (beide in identischer Größe und Schrift gerendert, Differenzbild über
  Canvas-`getImageData`).
- Die Exportformate SVG, PNG, BPMN 2.0 XML, draw.io XML und JSON wurden auf
  Vollständigkeit und Korrektheit geprüft.
- Interaktionen (Auswahl, Verschieben, Verbinden, Undo/Redo, Zwischenablage,
  Gruppieren, Sperren, Ausblenden) wurden bedient und gegen den JSON-Export als
  Modell-Wahrheit abgeglichen.

Während der gesamten Sitzung gab es **keine einzige Fehler- oder Warnmeldung in der
Browser-Konsole**.

## 2. Gesamteindruck

Die App ist deutlich weiter, als die vorhandene Dokumentation vermuten lässt. Sie
bietet Menüleiste, Lineale mit Hilfslinien, Vorlagen-/Bibliotheksverwaltung,
Formatpinsel, generisches Stil-Panel, Sperren/Ausblenden, Spiegeln, Größenangleich,
Zoom-an-Fenster-anpassen, Druckseiten-Vorschau, draw.io-Import/-Export und
PDF-Druck. Die Kernmechanik (Undo/Redo, Gruppieren, Sperren, Persistenz des Modells)
arbeitet in den Tests korrekt.

Die gefundenen Fehler konzentrieren sich fast vollständig auf **einen Bereich: die
Export-Renderer**. Das ist genau der Bereich, den `CLAUDE.md` als „größtes
Wartungsrisiko" benennt — die Befürchtung hat sich bestätigt, allerdings anders als
dort beschrieben (siehe Abschnitt 5).

## 3. Fehler

### 3.1 Schwerwiegend

**F-01 — Der Export ignoriert sämtliche Stil-Einstellungen.**
Ein Element mit Füllfarbe `#ff0000`, Linienfarbe `#00cc00`, Linienstärke 5 und
gestrichelter Linie wird exportiert als:
`<rect width="120" height="80" rx="8" fill="#f8fafc" stroke="#454d5a" stroke-width="1.5" />`
— also mit den **Standardwerten**. Betroffen sind Füllfarbe, Linienfarbe,
Linienstärke, Linienart, Transparenz und Schatten, in SVG **und** PNG. Als einzige
Stil-Eigenschaft wird die Rotation korrekt übernommen (`transform="rotate(45 300 300)"`).

Auswirkung: Das gesamte Stil-Panel ist für alles, was die App verlässt, wirkungslos.
Der Nutzer gestaltet ein Diagramm und erhält beim Export die Standarddarstellung
zurück. Da die Werte im JSON korrekt gespeichert werden, ist es kein Datenverlust,
aber der Export ist unbrauchbar für gestaltete Diagramme.
Vermutlich: `imageExport.ts` liest `shape.style` nicht aus.

**F-02 — Ausgeblendete Elemente erscheinen im Export.**
Ein per Kontextmenü ausgeblendetes Element verschwindet von der Zeichenfläche, ist im
exportierten SVG aber unverändert enthalten (verifiziert über gleichbleibende
Elementzahl und weiterhin vorhandenen Beschriftungstext „User Task"). Das widerspricht
der Erwartung an die Funktion und kann dazu führen, dass bewusst ausgeblendete Inhalte
ungewollt weitergegeben werden.

**F-03 — Tooltip-Text ist im Export unsichtbar.**
Auf dem Bildschirm: dunkel gefüllter Kasten (`fill="#333333"`) mit weißer Schrift
(`fill="#ffffff"`). Im Export wird aus der Füllung eine dünne Schraffur
(`fill="none" stroke="#333333" stroke-width="0.7"`), der Text bleibt weiß — also
**weiß auf weiß und damit unlesbar**. Der Inhalt des Elements geht im Export faktisch
verloren.

### 3.2 Deutlich sichtbar

**F-04 — Flächige Füllungen werden im Export zu Schraffuren.**
Dasselbe Muster wie F-03 (`fill`/`stroke` vertauscht, `stroke-width` 0 → 0.7) betrifft
8 Typen:
`wireframe.progressBar`, `wireframe.chart`, `wireframe.icon`, `wireframe.radio`,
`wireframe.scrollbar`, `wireframe.commentBubble`, `wireframe.tooltip`,
`wireframe.iconButton`.
Beispiel Fortschrittsbalken: auf dem Bildschirm ein durchgehend grauer Balken, im
Export ein schraffierter Umriss.

**F-05 — Linksbündige Beschriftungen werden im Export zentriert.**
Live `text-anchor="start"`, im Export `text-anchor="middle"` bei gleichzeitig anderer
x-Position. Betrifft 15 Typen:
`list`, `table`, `tree`, `card`, `checkbox`, `radio`, `combobox`, `spinner`,
`searchField`, `datePicker`, `panel`, `statusBar`, `accordion`, `dropdownMenu`,
`breadcrumb`.
Sichtbare Folge z.B. beim Kontrollkästchen: Die Beschriftung „Option" steht auf dem
Bildschirm rechts neben dem Kästchen, im Export **überlappt sie das Kästchen**.

**F-06 — Abweichende Text-Grundlinie zwischen Bildschirm und Export.**
Betrifft 11 Typen, u.a. alle Task-Varianten, `bpmn.subProcess`, `text.label`,
`wireframe.label`. Beim Text-Element beträgt der Versatz 5 px
(live `y="30"`, Export `y="35"`), bei `wireframe.label` 2 px. Der Export ist dabei
meist der optisch korrektere (vertikal zentrierte) Wert — die Abweichung ist also eher
ein Hinweis darauf, dass die **Live-Darstellung** die Grundlinienkorrektur vermissen
lässt.

Zur Einordnung von F-03 bis F-06: Von 64 geprüften Typen rendern **36 pixelgenau
identisch**, 28 weichen ab.

### 3.3 BPMN-XML-Export

**F-07 — Ereignis-Definitionen gehen verloren.**
Ein Start-Ereignis vom Typ Timer wird exportiert als
`<bpmn:startEvent id="…"></bpmn:startEvent>` — **ohne** `<bpmn:timerEventDefinition>`.
Gleiches gilt für Nachrichten- und Fehler-Ereignisse aller Ausprägungen. Nach einem
Export/Import-Zyklus sind Timer-, Nachrichten- und Fehlerereignisse nicht mehr von
gewöhnlichen Ereignissen unterscheidbar. Der visuelle Unterschied auf der
Zeichenfläche existiert, die semantische Information wird beim Export verworfen.

**F-08 — Pool und Lane erzeugen ungültiges BPMN.**
Ein Pool erzeugt im `<bpmn:process>` **kein Element**, gleichzeitig aber im
Diagrammteil:
```xml
<bpmndi:BPMNShape id="shape_…_di" bpmnElement="shape_…">
```
Die Referenz `bpmnElement` zeigt damit auf ein Element, das in der Datei nicht
existiert. Es wird weder `<bpmn:collaboration>`/`<bpmn:participant>` noch
`<bpmn:laneSet>` ausgegeben. Das Ergebnis ist kein gültiges BPMN 2.0 und wird von
importierenden Werkzeugen abgelehnt oder stillschweigend verworfen. Dasselbe
Referenzmuster tritt bei Wireframe-Elementen auf.

**F-09 — Zwischenereignisse werden als Throw-Events ausgegeben.**
`bpmn.event.intermediate.timer` wird zu `<bpmn:intermediateThrowEvent>`. Timer-
Ereignisse sind in BPMN 2.0 ausschließlich Catch-Events; korrekt wäre
`<bpmn:intermediateCatchEvent>`. Solange F-07 besteht, fällt das nicht auf — nach
dessen Behebung würde daraus ungültiges BPMN.

**F-10 — Wireframe-Diagramm als BPMN exportiert ergibt eine leere Prozessdatei.**
Ohne jede Rückmeldung an den Nutzer. Ein Hinweis („Dieses Diagramm enthält keine
BPMN-Elemente") wäre angebracht.

### 3.4 Interaktion

**F-11 — Der sichtbare Verbindungs-Port ist nicht benutzbar.**
Beim Überfahren eines Elements erscheinen vier Port-Kreise (Radius 5) auf den
Kantenmitten. Vermessung der Trefferzonen am rechten Port eines Tasks (Kante bei
+60 px relativ zur Elementmitte):

| Position relativ zur Kante | oberstes Element | Cursor | Ziehen bewirkt |
|---|---|---|---|
| −4 bis −2 px | Port-Kreis (r=5) | `crosshair` | nichts |
| 0 bis +7 px | Trefffläche des Elements | `move` | Element wird verschoben |
| +8 bis +12 px | äußerer Ring (r=10) | `copy` | Verbindung wird erzeugt |

Der sichtbar gezeichnete Port erzeugt also in **keiner** Position eine Verbindung: Auf
seiner äußeren Hälfte liegt die Verschiebe-Trefffläche darüber, auf seiner inneren
Hälfte zeigt er zwar ein Fadenkreuz, reagiert aber nicht. Funktionsfähig ist
ausschließlich der äußere Ring, der **außerhalb** des sichtbaren Ports liegt. Wer den
Port anklickt — also das, was die Oberfläche als Bedienelement anbietet —, verschiebt
das Element.

Das erklärt vermutlich auch, warum das Lastenheft unter Z-06 „gerichtete Hover-Pfeile"
fordert: Die vorhandene Funktion existiert bereits (der äußere Ring erzeugt per Klick
ein neues, verbundenes Element), ist aber durch die überlagerte Trefffläche schwer
zu treffen.

**F-12 — Mehrfaches Einfügen stapelt alle Kopien an derselben Stelle.**
Ein Element bei (240, 260) kopiert und dreimal eingefügt ergibt drei Kopien bei
**jeweils (270, 290)** — exakt übereinander. Der Nutzer sieht eine Kopie und hat drei.
Erwartet wäre ein fortlaufender Versatz.

**F-13 — Strg+D dupliziert nicht.**
Die Funktion „Duplizieren" existiert im Menü „Bearbeiten" und im Kontextmenü, ist aber
auf keine Tastenkombination gelegt (das Menü zeigt konsequenterweise auch kein Kürzel
an). Strg+D bleibt wirkungslos. Für eine so häufige Aktion ist das eine spürbare
Lücke.

## 4. Inkonsistenzen in der Dokumentation

### 4.1 Das Lastenheft ist weitgehend überholt

`Lastenheft-Zeichenwerkzeuge.md` beschreibt in der Spalte „Ist-Zustand" durchgängig
einen älteren Stand. Verifiziert an der laufenden App:

| ID | Lastenheft sagt | Tatsächlich |
|---|---|---|
| Z-01 | „rendert genau einen Griff (unten-rechts)" | **8 Griffe** mit korrekten Cursorn (`nwse`/`ns`/`nesw`/`ew`) |
| Z-03 | „nur Einzel-Shape-Resize" | **Gruppen-Resize vorhanden** (8 Griffe bei Mehrfachauswahl) |
| Z-04 | „Nicht vorhanden, nur Rotation" | **Horizontal/Vertikal spiegeln** im Kontext- und Anordnen-Menü |
| Z-05 | „Kein Lock-/Hidden-Flag" | **Sperren und Ausblenden vorhanden**; Sperre verhindert Verschieben *und* Löschen |
| Z-06 | „Nicht vorhanden" | **Äußerer Schnellverbinder-Ring vorhanden**, erzeugt per Klick ein neues verbundenes Element (aber schwer treffbar, siehe F-11) |
| Z-13 | „Nicht vorhanden" | **Breite/Höhe/Größe angleichen** im Anordnen-Menü |
| Z-14 | „Nicht vorhanden" | **Formatpinsel** in Symbolleiste und Kontextmenü |
| Z-15 | „nur BPMN-fachliche Felder" | **Vollständiges Stil-Panel**: Füllfarbe, Linienfarbe, Linienstärke, Linienart, Transparenz, Schatten, Zurücksetzen |
| Z-16 | „Kein `zoomToFit`/`resetView` gefunden" | **An Fenster anpassen / Auswahl zoomen / Zoom zurücksetzen** im Ansicht- und Kontextmenü |
| Z-17 | „Nur Punktgitter, keine Lineale" | **Lineale vorhanden** (`.ruler-horizontal`/`.ruler-vertical`) inkl. ziehbarer Hilfslinien |
| Z-18 | „Nicht vorhanden" | **Druckseiten-Vorschau** im Ansicht-Menü |

Damit ist der Kern des Lastenhefts erledigt — einschließlich der drei Punkte, die es
selbst als wichtigste Empfehlung nennt (Z-06, Z-01/Z-03, Z-16). Die verbleibenden
offenen Punkte sind vor allem Z-02 (Seitenverhältnis-Sperre), Z-07 (freie
Verbindungspunkte), Z-08 (wählbarer Verbindungsstil), Z-09 (Line Jumps),
Z-10 (Wegpunkt per Doppelklick) und Z-19 (Tab-Workflow); diese habe ich nicht
gezielt geprüft.

### 4.2 CLAUDE.md beschreibt einen älteren Funktionsumfang

Nicht erwähnt, aber vorhanden: Menüleiste (Datei/Bearbeiten/Ansicht/Anordnen/Hilfe),
Lineale und Hilfslinien, Vorlagen-/Bibliotheksverwaltung, Toast-Benachrichtigungen,
Schnellzugriffsleiste, draw.io-Import **und** -Export, JSON-Export, Drucken/PDF,
Sperren/Ausblenden, Spiegeln, Ausrichten/Verteilen/Größenangleich, Formatpinsel,
generisches Stil-Panel.

Die Exportliste in CLAUDE.md nennt nur SVG/PNG und BPMN-XML; tatsächlich gibt es
sechs Exportwege: SVG, PNG, BPMN 2.0 XML, draw.io XML, JSON, Drucken/PDF.

Innere Widersprüche: Der Abschnitt zum Quellbaum bezeichnet `modules/bpmn/` als
„The (only) diagram module", während der Text darüber zwei Module beschreibt. Das
Wireframe-Modul fehlt im Baumdiagramm vollständig.

### 4.3 Die Annahme zum Wireframe-Modul trifft nicht zu

CLAUDE.md hält fest, das Export-Drift-Problem sei „für das Wireframe-Modul
gelöst", da `sketch.ts` identische Pfaddaten an Live-Renderer und Export liefere; es
verbleibe nur noch die mechanische Registrierung.

Die Messung widerspricht dem: Gerade die Wireframe-Typen zeigen die meisten
Abweichungen (F-04 Füllung→Schraffur bei 8 Typen, F-05 Textausrichtung bei 15 Typen).
Die geteilten Primitive sichern offenbar die **Geometrie** der Umrisse, nicht aber
**Füllung und Textplatzierung** — diese werden in Live-Renderer und Export weiterhin
getrennt bestimmt und sind auseinandergelaufen.

Positiv und ebenfalls überprüft: Die von CLAUDE.md befürchtete Form des Fehlers —
ein Shape-Typ fehlt komplett in einem Ausgabeweg — tritt **nicht** auf. Alle 67 Typen
sind im SVG-Export vorhanden, alle BPMN-Typen haben ein korrektes XML-Tag, und der
draw.io-Export erzeugt für jeden Typ eine Zelle. Die „Vierfach-Pflege" wurde also
lückenlos durchgehalten; auseinandergelaufen sind die Details innerhalb der
Implementierungen.

## 5. Verbesserungsvorschläge

**Priorität 1 — Exporttreue herstellen.**
F-01 und F-02 machen den Export für gestaltete Diagramme unbrauchbar bzw. inhaltlich
falsch. Beide sind vermutlich punktuell zu beheben: Stil-Objekt in
`renderShapeToStaticSvg()` auswerten, ausgeblendete Elemente vor dem Rendern filtern.

**Priorität 2 — BPMN-Export korrigieren.**
F-08 (ungültige Referenzen) verhindert den Import in andere Werkzeuge; F-07
(fehlende Ereignis-Definitionen) macht den Export für Timer-/Nachrichtenprozesse
inhaltlich wertlos. Beides betrifft den erklärten Zweck des Formats.

**Priorität 3 — Port-Trefffläche entzerren.**
F-11 ist ein Fehler in der Ebenenreihenfolge bzw. der Größe der Verschiebe-Trefffläche.
Die Port-Kreise gehören über die Trefffläche des Elements gelegt. Das dürfte die
Verbindungserstellung spürbar verbessern — und macht den bereits vorhandenen
Schnellverbinder erst nutzbar.

**Priorität 4 — Dokumentation nachziehen.**
Der „Ist-Zustand" im Lastenheft sollte aktualisiert oder das Dokument als erledigt
markiert werden; in seiner jetzigen Form führt es zu Doppelarbeit an bereits
umgesetzten Funktionen. CLAUDE.md sollte die tatsächlichen Module, Menüs und
Exportwege nennen und die Aussage zum gelösten Wireframe-Export korrigieren.

**Weitere Vorschläge (geringere Dringlichkeit)**
- Einfügen mit fortlaufendem Versatz (F-12), Tastenkürzel für Duplizieren (F-13).
- Warnung beim BPMN-Export eines Diagramms ohne BPMN-Elemente (F-10).
- Einheitliche Grundlinienkorrektur für Beschriftungen (F-06) — am besten, indem
  Live-Renderer und Export dieselbe Funktion für Textplatzierung benutzen.
- Neu abgelegte Elemente direkt selektieren; derzeit ist nach dem Ablegen nichts
  ausgewählt, sodass Kopieren/Löschen im Menü ausgegraut bleiben.
- Elemente tragen im DOM keine stabile Kennung (kein `data-shape-id`). Ein solches
  Attribut würde automatisierte Prüfungen erheblich vereinfachen — angesichts der
  hier gefundenen Export-Abweichungen wäre ein kleiner, wiederholbarer
  Vergleichstest „Bildschirm gegen Export" ein wirksames Sicherheitsnetz.

## 6. Was einwandfrei funktioniert

Damit der Bericht nicht schiefliegt — folgende Punkte wurden geprüft und arbeiten
korrekt:

- Keinerlei Konsolenfehler oder -warnungen während der gesamten Sitzung.
- Undo/Redo über Tastatur (Strg+Z/Strg+Y) **und** Menü, über mehrere Schritte hinweg
  fehlerfrei (3→2→1→0 und zurück).
- Vollständigkeit aller Ausgabewege: 67 von 67 Typen im SVG-Export, korrekte
  BPMN-Tags für alle echten BPMN-Elemente, draw.io-Zelle für jeden Typ.
- 36 von 64 Typen rendern zwischen Bildschirm und Export **pixelgenau identisch**.
- Sperren schützt zuverlässig vor Verschieben und Löschen.
- Gruppieren/Gruppierung aufheben setzt und entfernt die `groupId` korrekt.
- Speicherung im JSON ist vollständig: Position, Größe, Rotation, Füllfarbe, Schatten
  und Sperr-Status werden geschrieben — die Stil-Informationen gehen also nur beim
  Bild-Export verloren, nicht beim Speichern.
- Der theme-fest gesetzte helle Zeichenflächen-Hintergrund und die Vermeidung des
  Browser-Zooms bei Strg+Mausrad verhalten sich wie in CLAUDE.md beschrieben.
