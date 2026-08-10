# Lastenheft: Zeichenwerkzeuge & Zeichenflächen-Komfort

Status: Entwurf (Anforderungserhebung durch Vergleich mit draw.io)
Bezug: `bpmn-editor-source/src/core/canvas/` (CanvasEngine.tsx, ResizeHandle.tsx, pathRouting.ts, alignmentGuides.ts, GridLayer.tsx)

## 1. Zweck und Geltungsbereich

Dieses Dokument listet Anforderungen an die Zeichenfläche und die Zeichenwerkzeuge des
BPMN-Editors, die sich aus einem gezielten Vergleich mit draw.io ergeben haben. Der
Fokus liegt ausschließlich auf dem **Erstellen und Bearbeiten von Diagrammen auf der
Zeichenfläche selbst** (Auswahl, Transformation, Verbindungen, Ausrichtung, Ansicht,
Eingabekomfort) — nicht auf Im-/Export-Formaten, Persistenz, Kollaboration oder
zusätzlichen Diagrammtypen/Modulen. Diese anderen Themen wurden in einem separaten,
vorangegangenen Vergleich identifiziert und sind hier bewusst ausgeklammert.

Jede Anforderung nennt den heute beobachteten Ist-Zustand (mit Codebezug, soweit
bekannt) sowie eine vorgeschlagene Priorität:

- **Muss** — hoher Alltagsnutzen, in draw.io ein Kernwerkzeug, spürbare Lücke
- **Soll** — spürbarer Komfortgewinn, aber Umgehungslösung heute vorhanden
- **Kann** — Nice-to-have, geringer Aufwand/Nutzen-Vorteil eher kosmetisch

## 2. Ausgangslage

Bereits vorhanden und mit draw.io vergleichbar: Marquee-Selektion, Rotation (Ziehgriff
mit 15°-Snap via Shift, +90°-Schnellrotation), Pfeiltasten-Nudge, Gruppierung
(Strg+G), A*-basiertes Verbinder-Routing mit manuellem Wegpunkt-Ziehen und
Reconnect, Alignment-Guides beim Verschieben, Punktgitter, Undo/Redo, sowie ein
aktives Ausrichten/Verteilen-Menü für Mehrfachauswahl (`ui/Toolbar/AlignMenu.tsx`,
Store-Actions `alignShapes`/`distributeShapes`: links/rechts/oben/unten/horizontal-
/vertikal-zentrieren, horizontal/vertikal verteilen). Diese Punkte sind nicht Teil
der folgenden Anforderungsliste.

## 3. Anforderungen

### 3.1 Auswahl & Transformation

| ID | Anforderung | Ist-Zustand | Priorität |
|---|---|---|---|
| Z-01 | Resize-Griffe an allen 8 Punkten (4 Ecken + 4 Kantenmitten) statt nur unten-rechts | `ResizeHandle.tsx` rendert genau einen Griff (unten-rechts) | Muss |
| Z-02 | Seitenverhältnis-Sperre beim Resize (z.B. Shift gedrückt halten) | Nicht vorhanden | Soll |
| Z-03 | Mehrfachauswahl gemeinsam/proportional skalieren | Nur Einzel-Shape-Resize; `resizingShapeId` ist ein einzelner Ref, kein Gruppen-Pendant zu `dragGroupIds` | Muss |
| Z-04 | Horizontal-/Vertikal-Spiegeln (Flip) einzelner oder mehrerer Shapes | Nicht vorhanden, nur Rotation | Soll |
| Z-05 | Elemente sperren (Lock Position) und/oder ausblenden (Hide) | Kein Lock-/Hidden-Flag in `ShapeInstance` | Soll |

### 3.2 Verbindungen & Routing

| ID | Anforderung | Ist-Zustand | Priorität |
|---|---|---|---|
| Z-06 | Gerichtete Hover-Pfeile: beim Überfahren eines Shapes 4 Pfeile anzeigen, die per Klick+Ziehen automatisch ein neues, bereits verbundenes Shape in der jeweiligen Richtung erzeugen | Nicht vorhanden — Verbindungen müssen manuell von einem Port gezogen werden | Muss |
| Z-07 | Freie/floatende Verbindungspunkte zusätzlich zu festen Ports | Nur festes 4er-Set pro Shape (oben/rechts/unten/links, mittig) | Soll |
| Z-08 | Wählbarer Verbindungsstil (gerade / orthogonal / kurvig-bezier / Entity-Relation-Knick) pro Verbinder | Fix auf orthogonales A*-Routing | Kann |
| Z-09 | "Line Jumps": kleiner Bogen an Kreuzungspunkten zweier unabhängiger Linien, damit keine Verbindung suggeriert wird | Nicht vorhanden | Kann |
| Z-10 | Neuen Wegpunkt per Doppelklick auf ein Verbinder-Segment einfügen | Nur Ziehen bereits vorhandener Wegpunkte bestätigt; Hinzufügen vermutlich nicht unterstützt | Soll |

### 3.3 Ausrichtung & Formatierung

| ID | Anforderung | Ist-Zustand | Priorität |
|---|---|---|---|
| Z-13 | Größenangleich ("Match Size") für Mehrfachauswahl | Nicht vorhanden — `AlignMenu.tsx`/`alignShapes`/`distributeShapes` decken nur Ausrichten und Verteilen ab, keine Größenangleichung | Kann |
| Z-14 | Formatpinsel / "Format übertragen" (Copy Style → Paste Style) zwischen Shapes | Nicht vorhanden | Soll |
| Z-15 | Generisches visuelles Stil-Panel (Füllfarbe, Linienfarbe/-stärke/-stil, Schatten, Transparenz) unabhängig von den BPMN-Fachfeldern | `PropertiesPanel` zeigt aktuell nur BPMN-fachliche Felder (Label, Trigger-Typ etc.) | Kann |

~~Z-11 (Ausrichten-Menü) und Z-12 (Verteilen) entfernt~~ — beide existieren bereits
über `ui/Toolbar/AlignMenu.tsx` (Store-Actions `alignShapes`/`distributeShapes`),
siehe Abschnitt 2. Beim ersten Scan übersehen, da nur die passiven Alignment-Guides
in `CanvasEngine.tsx` geprüft wurden.

### 3.4 Ansicht & Zeichenfläche

| ID | Anforderung | Ist-Zustand | Priorität |
|---|---|---|---|
| Z-16 | "An Fenster anpassen" / "Auswahl zoomen" / Zoom zurücksetzen als Schnellzugriff | Kein `zoomToFit`/`resetView` im Code gefunden — nur manuelles Wheel-Zoom+Pan | Muss |
| Z-17 | Lineale am Zeichenflächenrand mit ziehbaren eigenen Hilfslinien | Nur Punktgitter (`GridLayer.tsx`), keine Lineale | Kann |
| Z-18 | Optionale Druckseiten-Vorschau (gestrichelte Seitenränder) auf der sonst unendlichen Zeichenfläche | Nicht vorhanden | Kann |

### 3.5 Eingabekomfort

| ID | Anforderung | Ist-Zustand | Priorität |
|---|---|---|---|
| Z-19 | Tab-Workflow: bei Texteingabe in einem Shape erzeugt Tab automatisch ein neues, verbundenes Sibling-Shape | Nicht vorhanden | Kann |

## 4. Empfehlung

Der spürbarste Alltagsnutzen bei vertretbarem Aufwand liegt bei **Z-06** (gerichtete
Hover-Pfeile zum schnellen Verbinden), **Z-01/Z-03** (Resize-Griffe an allen 8 Punkten
inkl. Mehrfachauswahl) und **Z-16** (Zoom-an-Fenster-anpassen) — alle drei sind in
draw.io Kernwerkzeuge, die täglich genutzt werden, und lassen sich unabhängig von den
übrigen Punkten umsetzen.

## 5. Abgrenzung

Nicht Teil dieses Lastenhefts (siehe vorangegangener, separater Funktionsvergleich):
Mehrseiten-Dokumente, Ebenen (Layers), weitere Diagrammtypen/Module, Formatimport/-export
(draw.io, Visio, Mermaid), Kollaboration/Cloud-Anbindung, Versionshistorie,
Präsentationsmodus, Kommentare.
