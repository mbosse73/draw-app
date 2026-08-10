# CLAUDE.md

Diese Datei gibt Claude Code (claude.ai/code) Orientierung für die Arbeit mit dem Code
in diesem Repository.

## Aktueller Stand dieses Repositorys

**Wichtig: Das Git-Repository (`mbosse73/draw-app`) enthält derzeit nur das gebaute
Artefakt und Dokumentation — nicht das Quellprojekt.** Ein frischer Clone enthält:

- `index.html` (im Repository-Wurzelverzeichnis) — das **gebaute, einteilige
  Produktions-Artefakt** (minifiziert, React 19 + Zustand + gesamter App-Code via
  `vite-plugin-singlefile` inline gebündelt), d.h. eine Kopie von
  `bpmn-editor-source/dist/index.html`. Das ist das Deliverable, das der Endnutzer
  tatsächlich bekommt (direkt per Doppelklick geöffnet, kein Server) —
  **niemals von Hand editieren** und niemals versuchen, das minifizierte Bundle zu
  reverse-engineeren oder zu patchen. Es wird ausschließlich durch einen frischen Build
  aus dem Quellprojekt ersetzt.
  Nicht verwechseln: `index.html` **im Wurzelverzeichnis** ist das fertige Artefakt,
  `bpmn-editor-source/index.html` ist die Vite-Einstiegsseite der Entwicklung (mit dem
  Inline-Skript für das Theme), und `bpmn-editor-source/dist/index.html` ist das
  Build-Ergebnis. Hieß bis 08/2026 `bpmn-editor.html`; der Name `index.html` erlaubt
  es, die App über GitHub Pages direkt unter der Repository-URL auszuliefern.
- `Lastenheft-Zeichenwerkzeuge.md` — Lastenheft (deutsch) für Verbesserungen an
  Zeichenfläche und Zeichenwerkzeugen, abgeleitet aus einem Funktionsvergleich mit
  draw.io. Jede Anforderung (Z-01 … Z-19) nennt den beobachteten Ist-Zustand mit
  Codebezug und eine Priorität (Muss/Soll/Kann). Empfehlung des Dokuments: Das beste
  Aufwand/Nutzen-Verhältnis haben Z-06 (gerichtete Hover-Pfeile zum Erzeugen verbundener
  Shapes), Z-01/Z-03 (Resize-Griffe an allen 8 Punkten inkl. Mehrfachauswahl) und Z-16
  (Zoom-an-Fenster-anpassen). Vor Arbeiten an Canvas-/Werkzeug-Features konsultieren.
- `CLAUDE.md` — diese Datei.
- `README.md` — derzeit nur der Projektname.

- `bpmn-editor-source/` — das eigentliche Vite/React/TypeScript-Quellprojekt. **Hier
  findet die gesamte echte Entwicklung statt** (`npm install` / `npm run dev` /
  `npm run build` von innerhalb dieses Verzeichnisses ausführen — siehe Build & Start
  unten). Seit 08/2026 im Repository.

  > **⚠️ Der committete Quellstand ist älter als das ausgelieferte Wurzel-`index.html`
  > und erzeugt beim Bauen NICHT das aktuell ausgelieferte Artefakt.**
  > Ein `npm run build` mit anschließendem Kopieren über `../index.html` würde die
  > ausgelieferte App massiv zurückwerfen. Vor einem Build klären, ob ein aktuellerer
  > Quellstand vorliegt.
  >
  > Nachgewiesene Lücken (Quellstand → ausgeliefertes Artefakt):
  > - registrierte Shape-Typen: **32 → 67** — das gesamte Modul
  >   `modules/wireframe/` (41 Typen, „Desktop-Wireframes") fehlt im Quellstand,
  >   `App.tsx` ruft nur `registerBpmnModule()` auf
  > - `roughjs` fehlt in `package.json` (Abhängigkeit des Wireframe-Moduls)
  > - im Quellstand nicht vorhanden: Menüleiste, Lineale/Hilfslinien, generisches
  >   Stil-Panel (Füllfarbe/Linie/Transparenz/Schatten), Sperren/Ausblenden,
  >   Spiegeln, Formatpinsel, Ausrichten-Menü (`AlignMenu.tsx`),
  >   An-Fenster-anpassen, Druckseiten-Vorschau, Vorlagen-/Bibliotheksverwaltung,
  >   Theme-Umschaltung (`ui/Theme/`), draw.io-Import/-Export, JSON-Export,
  >   Drucken/PDF
  >
  > Die Architektur-Abschnitte unten beschreiben weiterhin den **Zielzustand** (also
  > das Artefakt) und sind als Referenz für Fragen zur App gültig; sie decken sich
  > an den genannten Stellen nicht mit dem committeten Quellstand.
- `BPMN-Editor-Technische-Dokumentation.md` — ein ausführliches technisches
  Übergabedokument (deutsch), das die Architektur im Detail beschreibt; ebenfalls nicht
  in dieses Repository committet (hier referenziert für den Fall, dass es lokal
  vorhanden ist).

Nach Änderungen an `bpmn-editor-source/src/` neu bauen und `dist/index.html` über das
Top-Level-Artefakt kopieren:

```bash
# bash
cd bpmn-editor-source && npm run build
cp dist/index.html ../index.html
```

```powershell
# PowerShell (der Rechner des Maintainers läuft unter Windows)
cd bpmn-editor-source; npm run build
Copy-Item dist/index.html ../index.html -Force
```

## Projektüberblick (aus der technischen Dokumentation)

Ein browserbasierter, **vollständig offline** laufender BPMN-2.0-Diagrammeditor. Das
ausgelieferte Artefakt ist eine einzelne HTML-Datei, die direkt im Browser geöffnet
wird — kein Server, keine Installation, kein Netzwerk zur Laufzeit. Der Dev-Stack
(sofern die Quellen vorhanden sind) ist normales Web-Tooling:

| Bereich | Wahl |
|---|---|
| Framework | React 19, TypeScript |
| Rendering | SVG (kein Canvas/WebGL) |
| State | Zustand 5 |
| Build | Vite 8 + `vite-plugin-singlefile` (bündelt alles in eine `dist/index.html`) |
| Styling | Eine einzige `App.css`, CSS Custom Properties als Design-Tokens |
| Persistenz | IndexedDB (Auto-Save), `localStorage` (Favoriten), File System Access API (optionaler Backup-Ordner, nur Chromium) |

Laufzeit-Abhängigkeiten: `react`, `react-dom`, `zustand`, plus **`roughjs`**
(hinzugefügt für das handskizzierte Rendering des Desktop-Wireframes-Moduls — eine
bewusste, dokumentierte Ausnahme, siehe `modules/wireframe/shapes/sketch.ts` und
Doku-Abschnitt 4.7). Bewusst **keine** Diagramm-Bibliothek (z.B. `bpmn-js`) — sämtliche
Rendering- und Interaktionslogik ist Eigenbau, gemäß ursprünglicher Spezifikation. Es
gibt **keine automatisierte Testsuite**; Verifikation lief historisch über
Wegwerf-Skripte per `npx tsx <script>.ts` direkt in Node (Zustand und Kernlogik sind
DOM-unabhängig), die nach Gebrauch gelöscht wurden.

### Build & Start

Alle Befehle laufen von innerhalb `bpmn-editor-source/`:

```bash
npm install
npm run dev      # Dev-Server, http://localhost:5173
npm run build    # Produktions-Build -> dist/index.html (das einteilige Deliverable)
npm run preview  # den Produktions-Build lokal testen
```

Nach `npm run build` die `dist/index.html` über die Top-Level-Datei `../index.html`
kopieren, um die Änderung tatsächlich auszuliefern (siehe oben) — die beiden sind sonst
nicht synchron.

## Zentrales Architekturprinzip: Core/Plugin-Trennung

> **`src/core/` darf niemals etwas BPMN-Spezifisches kennen.** Sämtlicher BPMN-Inhalt
> lebt ausschließlich unter `src/modules/bpmn/`.

Das ist eine funktionale Anforderung, keine Stilfrage: Künftige Diagrammtypen (UML,
Mindmaps, Flussdiagramme) sollen als neue Module unter `src/modules/<typ>/` ergänzbar
sein, **ohne `src/core/` anzufassen**. Der Core kennt nur generische Konzepte, denen
Module Bedeutung geben:

- `ShapeInstance.type: string` — ein opaker String (z.B. `"bpmn.task.user"`), den der
  Core selbst nie interpretiert; Verhalten wird über die `ShapeRegistry` nachgeschlagen.
- `ShapeDefinition.isContainer` / `.collapsedSize`/`.expandedSize` / `.isAttachable` —
  generische Verhaltens-Flags („verhält sich wie ein Container", „einklappbar",
  „anheftbar") ohne im Core eingebaute BPMN-Bedeutung.
- `ShapeDefinition.drawingType` — oberste Hierarchie-Ebene der Toolbox. Zwei echte
  Module registrieren sich inzwischen darauf: `"BPMN 2.0"` und `"Desktop-Wireframes"`
  (letzteres gezielt hinzugefügt, um zu beweisen — und inzwischen zu bestätigen —, dass
  ein zweites Modul ohne jede Core-Änderung andockt). Nur für die Anzeige, der Core
  verzweigt nie auf den Wert.
- `ConnectorInstance.connectorType: string` — analog zum Shape-Typ, aufgelöst über die
  `ConnectorTypeRegistry`.

**Lackmustest für jede Änderung an `src/core/`:** Braucht sie einen BPMN-Begriff (Task,
Gateway, Pool, Sequenzfluss, ...) in Code oder Kommentaren, gehört sie stattdessen nach
`src/modules/bpmn/`. Das wurde beim Hinzufügen von Sub-Prozessen und Boundary-Events
bewusst durchgesetzt — Container-/Anheft-Logik blieb generisch in
`core/canvas/containment.ts` und `core/canvas/attachmentGeometry.ts`, statt in
`CanvasEngine.tsx` als Spezialfall behandelt zu werden.

## Struktur des Quellbaums (unter `bpmn-editor-source/src/`)

```
src/
├── App.tsx / App.css / main.tsx     App-Wurzel, Modul-Registrierung, einziges Stylesheet
├── core/                            Generische Engine — KEIN BPMN-Wissen erlaubt
│   ├── shapes/                      types.ts, ShapeRegistry.ts, ConnectorTypeRegistry.ts
│   ├── state/                       canvasStore.ts (zentraler Zustand-Store, ~495 Zeilen),
│   │                                 history.ts (Undo/Redo), useHistoryStatus.ts, clipboard.ts
│   ├── canvas/                      CanvasEngine.tsx (~990 Zeilen, DIE zentrale Datei — s.u.),
│   │                                 ConnectorLayer.tsx, ShapePorts.tsx, ResizeHandle.tsx,
│   │                                 GridLayer.tsx, AlignmentGuidesLayer.tsx, MultilineText.tsx,
│   │                                 connectorGeometry.ts, connectorPath.ts, pathRouting.ts (A*),
│   │                                 containment.ts, attachmentGeometry.ts, alignmentGuides.ts,
│   │                                 autoLayout.ts
│   └── io/                          diagramSerializer.ts, fileIo.ts, imageExport.ts, autosave.ts,
│                                     useAutosave.ts, fileSystemBackup.ts
├── modules/bpmn/                    Das (einzige) Diagramm-Modul
│   ├── index.ts                     registerBpmnModule() — einziger Kontaktpunkt zum Core
│   ├── shapes/                      EventShapes, TaskShapes, GatewayShapes, DataObjectShape,
│   │                                 PoolLaneShapes, SubProcessShape, BoundaryEventShape, TextShape
│   ├── connectors/                  BpmnConnectorTypes.ts
│   └── io/                          bpmnXmlExport.ts (BPMN-2.0-XML-Serialisierung)
└── ui/                               Präsentationsschicht; darf Core und Module importieren
    ├── Toolbox/, Toolbar/, PropertiesPanel/, Autosave/, Help/
```

## Zentrale Architekturentscheidungen und Stolperfallen

### CanvasEngine.tsx ist die Interaktions-Zustandsmaschine

Alle Maus-Interaktionen (Verschieben, Marquee-Selektion, Resize, Verbinder-Ziehen,
Reconnect, Wegpunkt-Ziehen, Pan) laufen durch drei Handler (`handleMouseDown`,
`handleMouseMove`, `handleMouseUp`), die auf **wechselseitig exklusiven React-Refs**
verzweigen (keine States, um Re-Renders während des Ziehens zu vermeiden):
`draggingShapeId`, `dragGroupIds`, `resizingShapeId`, `draggingWaypoint`,
`isDraggingConnector`, `isReconnecting`, `isSelecting`. Es gibt kein explizites
Modus-Enum — diese Ref-Exklusivität *ist* die Zustandsmaschine, nur nicht als solche
modelliert. Vor einer Aufteilung dieser Datei verstehen, welche Refs sich gegenseitig
ausschließen; es wurde bewusst entschieden, sie als eine Datei zu belassen, weil eine
Aufteilung riskiert, diese implizite Invariante zu brechen. Nur für eine klar
umrissene neue Interaktion aufteilen, nicht aus Code-Hygiene-Gründen.

Mehrfachauswahl-Drag verschiebt alle selektierten Shapes gemeinsam über `moveShapesBy`,
mit Ausrichtungs-Snapping nur relativ zum zuerst gegriffenen Shape (dem „Anker").
Container-Kinder und angeheftete Boundary-Events bewegen sich rekursiv mit
(`collectDescendantIds`, `repositionAttachedShapes` in `canvasStore.ts`). Während des
Mehrfachauswahl-Drags (`isBulkDragging`) wird das teure A*-Routing zugunsten des
einfachen orthogonalen Fallback-Pfads übersprungen und rastet beim Loslassen wieder auf
A* ein — ein bewusster UX-Kompromiss.

### Verbinder-Routing (`pathRouting.ts`)

A* auf eigenem grobem Suchraster (`CELL_SIZE = 15`, unabhängig vom Anzeigeraster), mit
Hindernis-Rand (`OBSTACLE_MARGIN = 8`), einer Abbiege-Strafe (0.5/Richtungswechsel) zur
Bevorzugung gerader Linien und einer harten Suchobergrenze (`MAX_SEARCH_NODES = 8000`),
die auf einen einfachen orthogonalen Pfad zurückfällt, statt jemals einen Verbinder
nicht zu rendern. Pfad-Priorität (`connectorPath.ts`, `computeConnectorPath`): manuelle
Wegpunkte > A* > einfacher Fallback. Der A*-Suchraum wird pro Verbinder neu aufgebaut,
ohne verbinderübergreifendes Caching — nicht getestet in großem Maßstab
(>50 Verbinder).

### Auto-Layout (`autoLayout.ts`)

Bewusst ein eigenes, abhängigkeitsfreies, vereinfachtes Sugiyama-artiges
Schichten-Layout (kein dagre/ELK, gemäß expliziter Spezifikation): Longest-Path-
Schichtung, Barycenter-Heuristik für die Reihenfolge innerhalb einer Schicht, dann
Schicht→X / Reihenfolge→Y-Positionierung. Layoutet nur Top-Level-Elemente (kein
`parentId` **und** kein `attachedToId` — beides muss geprüft werden; ein früherer Bug
filterte nur auf `parentId` und platzierte Boundary-Events falsch). Pool-/Lane-Inhalte
bleiben absichtlich unangetastet, um die Container-Struktur zu erhalten.

### Undo/Redo (`history.ts`) läuft über Store-Subscription, nicht über manuelle Aufrufe

Ursprünglich wurde `pushHistorySnapshot()` an ~10 Stellen manuell aufgerufen — das war
fragil (Undo/Redo funktionierte über Buttons, aber nicht über Tastatur-Shortcuts). Der
aktuelle Ansatz: `initHistoryAutoTracking()` (einmalig auf Modulebene in `App.tsx`
aufgerufen, nicht in `useEffect`) abonniert `useCanvasStore` und debounced (400ms) einen
Snapshot bei jeder Referenzänderung von `shapes`/`connectors`, egal welcher Codepfad sie
ausgelöst hat. Die verstreuten manuellen Aufrufe (inzwischen als
`flushHistorySnapshot()` aliasiert) bleiben unschädlich und werden weiter dort genutzt,
wo ein sofortiger Commit nötig ist (z.B. flusht `undo()` immer zuerst, damit keine
laufende Änderung verloren geht). Snapshot-Modell: ein einzelner `currentSnapshot` plus
`undoStack`/`redoStack`-Arrays — der *alte* Snapshot wird auf den Stack gelegt, bevor
der neue Live-Zustand aktuell wird (diese Reihenfolge umgedreht ergibt einen
Off-by-One, der schon einmal auftrat). Viewport (Zoom/Pan) und Selektion werden von der
History bewusst **nicht** erfasst.

### Export-Renderer sind unabhängige Re-Implementierungen — das größte Wartungsrisiko

`imageExport.ts` (SVG/PNG-Export) und `ToolboxIcon.tsx` (Toolbox-Vorschau)
**re-implementieren** jeweils das visuelle Rendering jedes Shape-Typs von Grund auf,
unabhängig von den echten React-Komponenten in `modules/bpmn/shapes/*.tsx`. Die
Wiederverwendung der echten Komponenten über `renderToStaticMarkup()` aus
`react-dom/server` wurde versucht und verworfen — sie brach in der Node-basierten
Verifikationsumgebung (`npx tsx`, kein Browser-DOM) und ließ sich im Browser nicht
risikofrei absichern.

**Konsequenz: Jeder neue Shape-Typ braucht manuelle drei- (oder vier-)fache Pflege:**
1. Die echte React-Komponente
2. `imageExport.ts` → `renderShapeToStaticSvg()`
3. `ToolboxIcon.tsx`
4. Falls es ein eigenes BPMN-Flusselement ist: `modules/bpmn/io/bpmnXmlExport.ts` →
   `bpmnTagFor()` (ein realer früherer Bug: ein Shape fehlte deswegen komplett im
   XML-Export)

Etwas davon zu vergessen erzeugt keinen Fehler — es produziert stillschweigend ein
falsches/fehlendes Element in genau dieser einen Ausgabe. Beim Hinzufügen oder Ändern
eines Shape-Typs alle vier Stellen aktualisieren.

**Für das Wireframe-Modul ist das gelöst** (nicht rückwirkend auf BPMN übertragen):
`modules/wireframe/shapes/sketch.ts` kapselt `rough.generator()` aus `roughjs` als
pure, DOM-freie Funktionen (`sketchRect`, `sketchLine`, `sketchCircle`, `sketchPath`,
alle über `seedFor(shapeId, discriminator)` geseedet für deterministisches, nicht
flackerndes „Wackeln"), die identische Pfaddaten sowohl an den Live-JSX-Renderer
(`<SketchPaths>`) als auch an das stringbasierte
`renderWireframeShapeToStaticSvg()` in `imageExport.ts` liefern. Die eigentliche
„Wie sieht dieses Shape aus"-Logik existiert genau einmal pro Shape-Typ; nur die
*Registrierung* an drei Stellen bleibt (jetzt mechanisch, nicht fehleranfällig).
Sollten die BPMN-Shapes je auf ein ähnliches Shared-Primitive-Muster migriert werden,
ist das als separates, größeres Vorhaben zu behandeln — rückwirkend wurde es nicht
gemacht.

### Persistenz: drei unabhängige, nicht synchronisierte Mechanismen

| Mechanismus | Speicher | Inhalt | Zweck |
|---|---|---|---|
| Auto-Save | IndexedDB (`autosave.ts`) | Gesamtes Diagramm | Datenverlust-Schutz, ~alle 15s |
| Manuelles Speichern/Öffnen | Datei-Download (`diagramSerializer.ts`) | Gesamtes Diagramm + optional Favoriten | Bewusstes Speichern/Teilen |
| Favoriten | `localStorage` (`favoritesStore.ts`) | Nur Favoriten-Markierungen | Geräteweite UI-Präferenz über Diagramme hinweg |
| Einstellungsdatei | Datei-Download (`settingsIO.ts`) | Nur Favoriten | Übertragung auf einen anderen Rechner |

Favoriten werden beim Laden aus einer Diagramm-/Einstellungsdatei **additiv** gemergt
(`mergeFavorites`) — das Laden eines fremden Diagramms darf niemals die eigenen
Favoriten löschen. `core/io/` darf nicht von `ui/Toolbox/favoritesStore.ts` abhängen
(Architekturregel), daher nimmt `serializeDiagram(favoriteTypes?: Set<string>)` die
Favoriten als optionalen Parameter entgegen, den die aufrufende UI-Schicht
(`SaveLoadButtons.tsx`, `ExportMenu.tsx`) aus dem Favoriten-Store liest und übergibt.

### Design-Tokens vs. hartkodierte SVG-Farben

`App.css` folgt `UI-DESIGNGUIDE.md` (eine Ebene über diesem Projektverzeichnis):
dunkles Glassmorphism als Standard, umschaltbarer Flat-Light-Modus, alles abgeleitet
aus einer `--tint`-Basisvariable via `rgba(var(--tint), X)`. Umschalten über den
`ThemeToggleButton` (Toolbar) oder `Alt+M`; das Theme persistiert in
`localStorage["bpmnEditorTheme"]` und wird flickerfrei durch ein Inline-Skript im
`<head>` der `index.html` vor dem ersten React-Render angewendet —
`ui/Theme/themeStore.ts` muss weiterhin denselben Key lesen.

Der Canvas-Hintergrund (`--canvas-bg`/`--canvas-grid-dot`) folgt bewusst **nicht**
`--tint` — er bleibt in beiden Themes papierhell, da `imageExport.ts` immer auf weißem
Hintergrund exportiert und BPMNs dünne Schwarz-auf-Weiß-Notation auf dunklem Canvas
schlecht lesbar wäre. `modules/bpmn/shapes/constants.ts` (`BPMN_COLORS`) und die
hartkodierten Hex-Werte in `imageExport.ts` lesen weiterhin **nicht** aus CSS Custom
Properties (Inline-SVG-Styles kommen nicht ohne Weiteres an `App.css` heran) — mit
Ausnahme von `BPMN_COLORS.strokeSelected`, das inzwischen `var(--accent, ...)` ist,
damit die Selektions-Hervorhebung dem aktiven Theme folgt. Jede andere
Palettenänderung muss weiterhin `constants.ts` **und** `imageExport.ts` von Hand
aktualisieren.

Toolbar-Dropdowns und das Rechtsklick-Kontextmenü sind bewusst schlichte, nicht-modale
Popover, kein natives `<dialog>` — nur `HelpOverlay`/`ShortcutOverlay` nutzen
`<dialog>` + `showModal()` (über `ui/useModalDialog.ts`), da ein Modal für eine
schnelle Dropdown-Auswahl fälschlich den Fokus einsperren würde.

Das Wheel-Handling in `CanvasEngine.tsx` ist ein nativer, nicht-passiver
`addEventListener("wheel", ..., { passive: false })`, nicht Reacts synthetisches
`onWheel` — nötig, damit `preventDefault()` zuverlässig verhindert, dass
Strg+Mausrad/Trackpad-Pinch zusätzlich die ganze Browserseite zoomt (was so aussähe,
als würden Toolbar/Toolbox/Properties-Panel mit dem Canvas mitskalieren, obwohl sich
nur das `<g transform>` des Canvas ändert). `.canvas-area` setzt außerdem
`touch-action: none` und `overscroll-behavior: none` und unterdrückt Safaris
proprietäre `gesturestart`/`gesturechange`-Events.

## Bekannte Tastatur-Shortcut-Stolperfalle

Strg+Z/Strg+Y wirkten auf deutschen QWERTZ-Tastaturen vertauscht, weil `e.code` die
*physische* US-Tastenposition meldet (Y/Z sind gegenüber QWERTY vertauscht). Fix:
`e.key` statt `e.code` für Buchstaben-Shortcuts verwenden. `e.code` ist nur sicher für
Tasten mit gleicher physischer Position über gängige Layouts hinweg (A, C, V, G, ...);
für Y/Z immer `e.key` verwenden.

## Verifikation ohne Testsuite

Es gibt keinen Test-Runner im Projekt. Der etablierte Ansatz für isolierte Logik
(Store-Actions, `pathRouting.ts`, `autoLayout.ts`, `attachmentGeometry.ts`,
Serialisierer-/Export-Funktionen) ist ein Wegwerf-Skript per `npx tsx <script>.ts`, da
diese DOM-unabhängig sind. UI-Verhalten lässt sich in dieser Umgebung nicht
automatisiert verifizieren — das erfordert Nutzerbestätigung in einem echten Browser.
Node hat kein natives `localStorage`; für Store-Tests mit Persistenzbezug mit einer
minimalen `getItem`/`setItem`-Klasse mocken. ES-Modul-Hoisting beachten:
`import`-Anweisungen laufen vor synchronem Code derselben Datei, d.h. Mock-Storage-
Daten vor einem `import`-Statement zu setzen läuft nicht wirklich vor der
Store-Initialisierung — stattdessen dynamisches `await import(...)` nach dem Aufsetzen
der Mocks verwenden.
