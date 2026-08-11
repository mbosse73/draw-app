# CLAUDE.md

Diese Datei gibt Claude Code (claude.ai/code) Orientierung für die Arbeit mit dem Code
in diesem Repository.

---

## Schnellstart (das Wichtigste in 60 Sekunden)

**Was das hier ist:** Ein offline laufender BPMN-2.0-Diagrammeditor. Ausgeliefert wird
eine einzige Datei, `index.html` im Wurzelverzeichnis — das gebaute Bundle. Der Quellcode
liegt komplett unter `bpmn-editor-source/` (Vite + React 19 + TypeScript + Zustand).

**Alle Befehle laufen aus `bpmn-editor-source/`:**

```bash
npm run dev            # Dev-Server, http://localhost:5173
npm run build          # Produktions-Build -> dist/index.html
npm run verify         # Lint + Build + check:export  (vor jedem Commit)
npm run ship           # verify + dist/index.html über ../index.html kopieren
npm run check:export   # 64 Shape-Typen: Bildschirm gegen SVG-Export, pixelweise
```

**Vier Regeln, die nicht verhandelbar sind:**

1. `index.html` im Wurzelverzeichnis **niemals von Hand editieren** und das minifizierte
   Bundle nie reverse-engineeren oder patchen — es entsteht ausschließlich durch
   `npm run ship`. (Ein PreToolUse-Hook blockiert Schreibzugriffe darauf.)
2. `src/core/` darf **nichts** über ein Modul wissen — kein BPMN-Begriff, kein Import
   aus `src/modules/`, auch nicht im Kommentar.
3. Nach jeder Änderung an Shapes oder Export läuft `npm run verify`. Ein vergessener
   Export-Renderer erzeugt **keinen Fehler**, sondern still eine falsche Ausgabe.
4. Geändert wird nur die Quelle; ausgeliefert wird nur über `npm run ship`. Ist
   `index.html` nicht md5-gleich zu `dist/index.html`, ist die Auslieferung veraltet.

**Projektsprache ist Deutsch** — Code-Kommentare, Commit-Nachrichten, Dokumente und
Bezeichner in neuen Funktionen folgen dem vorhandenen deutschen Stil.

## Wo liegt was (Aufgabe → Datei)

| Aufgabe | Einstiegspunkt |
|---|---|
| Maus-Interaktion, Ziehen, Selektieren, Zoom/Pan | `core/canvas/CanvasEngine.tsx` (die zentrale Datei) |
| Zustand, Aktionen auf Shapes/Verbindern | `core/state/canvasStore.ts` |
| Undo/Redo | `core/state/history.ts` |
| Verbinder: Pfad, Routing, Andockpunkte | `core/canvas/connectorPath.ts`, `pathRouting.ts`, `connectorGeometry.ts` |
| Neuer Shape-Typ | Skill `shape-hinzufuegen` (vierfache Pflege!) |
| Neuer Diagrammtyp / Modul | Skill `modul-hinzufuegen` |
| Bild-Export (SVG/PNG/Druck) | `core/io/imageExport.ts` + `modules/*/io/staticSvg.ts` |
| BPMN-XML- / draw.io-Export | `modules/bpmn/io/bpmnXmlExport.ts`, `drawioExport.ts` |
| Speichern, Laden, Auto-Save | `core/io/diagramSerializer.ts`, `autosave.ts` |
| Toolbar, Menüleiste, Panels | `ui/Toolbar/`, `ui/PropertiesPanel/`, `ui/Toolbox/` |
| Aussehen, Themes, Design-Tokens | `App.css` (das einzige Stylesheet) |
| UI-Verhalten im Browser prüfen | Skill `app-im-browser-pruefen` |

## Werkzeuge dieses Repositorys (`.claude/`)

| Datei | Wirkung |
|---|---|
| `hooks/session-start.mjs` | Installiert fehlende `node_modules`, baut einmalig falls `dist/` fehlt, macht Chromium für `check:export` auffindbar, meldet Branch/Sauberkeit/Artefakt-Stand zum Sitzungsbeginn |
| `hooks/guard-artefakt.mjs` | Blockiert jeden Schreibzugriff auf `index.html` im Wurzelverzeichnis |
| `settings.json` | Registriert beide Hooks, erlaubt die üblichen Bau- und Git-Befehle ohne Rückfrage |
| `skills/shape-hinzufuegen/` | Checkliste für neue/geänderte Shape-Typen |
| `skills/modul-hinzufuegen/` | Anleitung für einen neuen Diagrammtyp als Modul |
| `skills/app-im-browser-pruefen/` | Playwright-Rezepte inkl. der Irrtümer, die schon zu falschen Befunden geführt haben |

Die Skills sind bewusst ausgelagert statt hier eingebettet: Sie werden nur geladen, wenn
die jeweilige Aufgabe ansteht, und halten diese Datei lesbar.

---

## Aktueller Stand dieses Repositorys

Ein frischer Clone enthält:

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
- `Befundbericht-App-Analyse.md` — Ergebnis der systematischen Fehlersuche 08/2026
  (F-01 … F-11). Alle Befunde sind abgearbeitet; das Dokument bleibt als Beleg, welche
  Fehlerklassen dieses Projekt real hervorbringt (stille Export-Abweichungen,
  Trefferzonen-Überdeckung, vergessene Registrierungen).
- `CLAUDE.md` — diese Datei.
- `README.md` — derzeit nur der Projektname.
- `.claude/` — Hooks, Berechtigungen und Skills für die Arbeit mit Claude Code
  (siehe Tabelle im Schnellstart oben).

- `bpmn-editor-source/` — das eigentliche Vite/React/TypeScript-Quellprojekt. **Hier
  findet die gesamte echte Entwicklung statt** (`npm install` / `npm run dev` /
  `npm run build` von innerhalb dieses Verzeichnisses ausführen — siehe Build & Start
  unten). **Seit 08/2026 im Repository committet** (ohne `node_modules`/`dist`, siehe
  die projekteigene `.gitignore`). Beide Module sind registriert
  (`registerBpmnModule()` **und** `registerWireframeModule()` in `App.tsx`),
  `roughjs` ist als Abhängigkeit enthalten — dieser Stand passt zum ausgelieferten
  `index.html`.

  > **⚠️ Vorsicht bei nachgereichten Quellstand-Archiven.** Vor diesem Stand wurden
  > zweimal ZIPs eingespielt, die deutlich **älter waren als das ausgelieferte
  > `index.html`** (32 statt 67 Shape-Typen, kein `modules/wireframe/`, kein
  > `roughjs`, ohne Menüleiste, Lineale, Stil-Panel, Sperren/Ausblenden, Spiegeln,
  > Formatpinsel, An-Fenster-anpassen, Druckseiten-Vorschau, Vorlagenverwaltung,
  > Theme-Umschaltung sowie draw.io-, JSON- und PDF-Export). Ein Build daraus hätte
  > die App massiv zurückgeworfen.
  > **Vor jedem Build aus einem nachgereichten Archiv prüfen, ob es zum Artefakt
  > passt** — schneller Test: `ls src/modules` muss `bpmn` *und* `wireframe` zeigen,
  > `grep rough package.json` muss anschlagen.
- `BPMN-Editor-Technische-Dokumentation.md` — ein ausführliches technisches
  Übergabedokument (deutsch), das die Architektur im Detail beschreibt; ebenfalls nicht
  in dieses Repository committet (hier referenziert für den Fall, dass es lokal
  vorhanden ist).

Nach Änderungen an `bpmn-editor-source/src/` genügt ein Befehl — er baut, prüft und
kopiert `dist/index.html` über das Top-Level-Artefakt (identisch unter bash und
PowerShell, der Rechner des Maintainers läuft unter Windows):

```bash
cd bpmn-editor-source && npm run ship
```

Der Kopierschritt war früher Handarbeit und wurde regelmäßig vergessen — dann war die
App gebaut, ausgeliefert wurde aber weiter der alte Stand, ohne jede Fehlermeldung.
`scripts/publish-artifact.mjs` erledigt und bestätigt ihn jetzt per Prüfsumme.

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
gibt **eine einzige automatisierte Prüfung**: `npm run check:export` vergleicht jeden
registrierten Shape-Typ pixelweise zwischen Bildschirm und SVG-Export (siehe
`scripts/check-export.mjs`, Exit-Code 1 bei Abweichung); `npm run verify` bündelt sie mit
Lint und Build. Darüber hinaus läuft Verifikation über Wegwerf-Skripte per
`npx tsx <script>.ts` direkt in Node (Zustand und Kernlogik sind DOM-unabhängig), die
nach Gebrauch gelöscht werden — siehe „Verifikation ohne Testsuite" am Ende.

### Build & Start

Alle Befehle laufen von innerhalb `bpmn-editor-source/`:

| Befehl | Bedeutung |
|---|---|
| `npm install` | Abhängigkeiten (erledigt in Claude-Sitzungen der SessionStart-Hook) |
| `npm run dev` | Dev-Server, http://localhost:5173 |
| `npm run build` | Produktions-Build → `dist/index.html` |
| `npm run preview` | den Produktions-Build lokal testen |
| `npm run lint` | Oxlint |
| `npm run check:export` | 64 Shape-Typen pixelweise Bildschirm gegen SVG-Export (braucht einen Build) |
| `npm run verify` | `lint` + `build` + `check:export` — die Standardprüfung vor jedem Commit |
| `npm run artefakt` | nur kopieren: `dist/index.html` → `../index.html`, mit Prüfsummen-Bestätigung |
| `npm run ship` | `verify` + `artefakt` — der komplette Auslieferungsweg |

`check:export` sucht sich Chromium selbst (ausdrücklicher `CHECK_EXPORT_CHROMIUM`-Pfad,
sonst ein Browser unter `PLAYWRIGHT_BROWSERS_PATH`, sonst Playwrights eigene Suche);
notfalls einmalig `npx playwright install chromium`.

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
├── core/                            Generische Engine — KEIN Modul-Wissen erlaubt
│   ├── shapes/                      types.ts, ShapeRegistry.ts (inkl. setStaticSvgRenderer),
│   │                                 ConnectorTypeRegistry.ts, shapeStyle.ts (Stil-Auflösung)
│   ├── state/                       canvasStore.ts (zentraler Zustand-Store),
│   │                                 history.ts (Undo/Redo), useHistoryStatus.ts, clipboard.ts
│   ├── canvas/                      CanvasEngine.tsx (~2100 Zeilen, DIE zentrale Datei — s.u.),
│   │                                 ConnectorLayer.tsx (+ ConnectorEndpointHandles),
│   │                                 ShapePorts.tsx, HoverArrows.tsx, ResizeHandle.tsx,
│   │                                 GridLayer.tsx, AlignmentGuidesLayer.tsx, MultilineText.tsx,
│   │                                 connectorGeometry.ts, connectorPath.ts, pathRouting.ts (A*),
│   │                                 containment.ts, attachmentGeometry.ts, alignmentGuides.ts,
│   │                                 autoLayout.ts
│   └── io/                          diagramSerializer.ts, fileIo.ts, autosave.ts,
│                                     useAutosave.ts, fileSystemBackup.ts,
│                                     imageExport.ts (Rahmen/Verbinder — KEINE Shape-Optik),
│                                     staticSvgPrimitives.ts (escapeXml, multilineTextMarkup)
├── modules/bpmn/                    Diagramm-Modul „BPMN 2.0"
│   ├── index.ts                     registerBpmnModule() — einziger Kontaktpunkt zum Core
│   ├── shapes/                      EventShapes, TaskShapes, GatewayShapes, DataObjectShape,
│   │                                 PoolLaneShapes, SubProcessShape, BoundaryEventShape, TextShape
│   ├── connectors/                  BpmnConnectorTypes.ts
│   └── io/                          bpmnXmlExport.ts (BPMN-2.0-XML-Serialisierung),
│                                     drawioExport.ts, staticSvg.ts (Shape-Optik für den Bild-Export)
├── modules/wireframe/               Diagramm-Modul „Desktop-Wireframes"
│   ├── index.ts                     registerWireframeModule()
│   ├── shapes/                      sketch.ts (Rough.js-Primitive + Stil-Overrides), SketchPaths.tsx,
│   │                                 Window/Container/Menu/Input/Button/DataDisplay/Text/Markup-Shapes
│   ├── connectors/                  WireframeConnectorTypes.ts
│   └── io/                          staticSvg.ts (Shape-Optik für den Bild-Export)
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
**re-implementieren** das visuelle Rendering jedes Shape-Typs von Grund auf,
unabhängig von den echten React-Komponenten in `modules/*/shapes/*.tsx`. Die
Wiederverwendung der echten Komponenten über `renderToStaticMarkup()` aus
`react-dom/server` wurde versucht und verworfen — sie brach in der Node-basierten
Verifikationsumgebung (`npx tsx`, kein Browser-DOM) und ließ sich im Browser nicht
risikofrei absichern.

**Seit 08/2026 liegt der Export-Renderer aber nicht mehr im Core.** `core/` darf
kein Modul kennen; `imageExport.ts` importierte trotzdem `sketch.ts` aus
`modules/wireframe/` und hatte sämtliche BPMN-Formen fest verdrahtet. Jetzt gilt:

- `core/io/imageExport.ts` kennt nur noch Rahmen, Verbinder, Stil-Hülle
  (Deckkraft/Schatten/Rotation) und einen generischen Rechteck-Notnagel.
- Die Darstellung der Shapes liefert das jeweilige Modul:
  `modules/bpmn/io/staticSvg.ts` und `modules/wireframe/io/staticSvg.ts`,
  registriert in der jeweiligen `index.ts` über
  `ShapeRegistry.setStaticSvgRenderer(drawingType, fn)`. Der Schlüssel ist der
  `drawingType` — derselbe undurchsichtige String, den die Toolbox zur
  Gruppierung nutzt und den der Core nie interpretiert.
- Gemeinsame, modulfreie Bausteine (`escapeXml`, `multilineTextMarkup`) liegen in
  `core/io/staticSvgPrimitives.ts`.

Ein neues Modul dockt seinen Export damit ohne jede Core-Änderung an.

**Konsequenz: Jeder neue Shape-Typ braucht weiterhin manuelle drei- (oder
vier-)fache Pflege:**
1. Die echte React-Komponente
2. `modules/<typ>/io/staticSvg.ts` (der Export-Renderer des Moduls)
3. `ToolboxIcon.tsx`
4. Falls es ein eigenes BPMN-Flusselement ist: `modules/bpmn/io/bpmnXmlExport.ts` →
   `bpmnTagFor()` (ein realer früherer Bug: ein Shape fehlte deswegen komplett im
   XML-Export)

Etwas davon zu vergessen erzeugt keinen Fehler — es produziert stillschweigend ein
falsches/fehlendes Element in genau dieser einen Ausgabe. **`npm run check:export`
meldet genau das** und sollte nach jeder Änderung an Shapes oder Export laufen.
Die vollständige Checkliste dafür liegt im Skill `shape-hinzufuegen`.

**Zum Wireframe-Modul:** `modules/wireframe/shapes/sketch.ts` kapselt
`rough.generator()` aus `roughjs` als pure, DOM-freie Funktionen (`sketchRect`,
`sketchLine`, `sketchCircle`, `sketchPath`, alle über
`seedFor(shapeId, discriminator)` geseedet für deterministisches, nicht
flackerndes „Wackeln"), die identische Pfaddaten an den Live-JSX-Renderer
(`<SketchPaths>`) und an `sketchPathsToSvgString()` im Export liefern.
> **Nachgemessen und widerlegt:** Die geteilten Primitive sichern nur die
> *Geometrie der Umrisse*. Füllung und Textplatzierung wurden getrennt bestimmt
> und waren auseinandergelaufen — 28 von 64 Typen wichen sichtbar ab (fehlendes
> `fillStyle: "solid"` liess Füllungen zu Schraffuren werden, linksbündige Labels
> wurden zentriert). Behoben und seither durch `npm run check:export` abgesichert.

Die Stil-Panel-Overrides (Z-15) laufen für Wireframe-Shapes über **einen**
gemeinsamen Punkt: `applySketchStyleOverride()` in `sketch.ts`, genutzt von
`<SketchPaths>` und `sketchPathsToSvgString()`. Dabei wichtig: Rough.js legt die
Füllfarbe je nach Füllstil an unterschiedliche Stellen — bei der voreingestellten
Schraffur in den `stroke` der Füll-Linien, bei `fillStyle: "solid"` in deren
`fill`. Deshalb trägt jeder `SketchPath` ein `role: "fill" | "outline"`; die
Kontur ist immer der letzte von Rough.js gelieferte Pfad. Ein blindes
Überschreiben von `fill` machte aus den Schraffurlinien eine gefüllte
Zickzackfläche.

Sollten die BPMN-Shapes je auf ein ähnliches Shared-Primitive-Muster migriert werden,
ist das als separates, größeres Vorhaben zu behandeln — rückwirkend wurde es nicht
gemacht.

### Zeichen-Ebenen: Reihenfolge ist Bedienlogik, nicht Kosmetik

In `CanvasEngine.tsx` entscheidet die DOM-Reihenfolge, welches Bedienelement einen
Klick bekommt — SVG kennt kein `z-index`, der zuletzt gezeichnete Knoten gewinnt.
Zwei reale Fehler kamen genau daher (beide 08/2026 behoben, siehe Befundbericht F-11):

- Die unsichtbaren „Brücken"-Rechtecke der Hover-Pfeile (`HoverArrows`, 18 px vom
  Shape-Rand bis zum Pfeil) lagen über der äußeren Hälfte der Verbindungs-Ports.
  Ein Klick auf den sichtbar gezeichneten Port verschob das Element. Reihenfolge
  daher jetzt bewusst: **HoverArrows → ShapePorts → ResizeHandle** (vom
  schwächsten zum stärksten Anspruch).
- Die Endpunkt-Griffe einer ausgewählten Verbindung wurden in der
  `ConnectorLayer` gezeichnet, die absichtlich *unter* den Shapes liegt (Linien
  sollen nicht über Formen laufen). Da ein Endpunkt per Definition auf dem Rand
  seines Shapes sitzt, war er nie anklickbar. Sie liegen jetzt als eigene
  Komponente `ConnectorEndpointHandles` in einer Ebene **über** den Shapes.

Wer hier etwas umsortiert, sollte die Trefferzonen messen (`elementFromPoint` +
`getComputedStyle(...).cursor` entlang einer Achse), nicht schätzen.

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

Drei Stufen, von billig nach teuer:

1. **`npm run verify`** — Lint, Build, `check:export`. Deckt alles ab, was die
   Shape-Darstellung betrifft, und läuft in gut einer Minute.
2. **Wegwerf-Skript in Node** (`npx tsx <datei>.ts`) für DOM-unabhängige Logik —
   Store-Aktionen, `pathRouting.ts`, `autoLayout.ts`, `attachmentGeometry.ts`,
   Serialisierer. Danach löschen, nicht committen.
3. **Playwright gegen `dist/index.html`** für alles Interaktive — Rezepte und
   Fallstricke im Skill `app-im-browser-pruefen`. Was dort nicht messbar ist
   (Optik-Urteile, Bedienbarkeit), braucht Bestätigung durch den Nutzer im echten
   Browser.

Es gibt keinen allgemeinen Test-Runner im Projekt. Der etablierte Ansatz für isolierte Logik
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

## Arbeitsweise in diesem Repository

- **Deutsch** in Code-Kommentaren, Commit-Nachrichten, Dokumenten und Antworten.
- **Commit-Nachrichten** im Stil der vorhandenen Historie: eine Zeile, Infinitiv,
  was und warum (`Frisch abgelegte Elemente auswaehlen, stabile DOM-Kennung ergaenzen`).
- **Vor jedem Commit `npm run verify`**, vor jeder Auslieferung `npm run ship`.
  Zum Commit gehören dann Quelle **und** neu gebautes `index.html`.
- **Wegwerf-Skripte** in den Scratchpad-Ordner, nicht ins Repository.
- **Große Refactorings an `CanvasEngine.tsx` nicht aus Hygienegründen** — die
  wechselseitig exklusiven Refs sind eine ungeschriebene Invariante (siehe oben).
- **Zuerst den Code lesen, dann den Dokumenten glauben.** Lastenheft und Befundbericht
  sind Momentaufnahmen; mehrfach war eine dort als offen geführte Anforderung längst
  umgesetzt (und einmal ein Befund schlicht falsch).

### Offener Stand (08/2026)

- `Befundbericht-App-Analyse.md`: alle Befunde F-01 … F-11 abgearbeitet.
- `Lastenheft-Zeichenwerkzeuge.md`: einzig **Z-19** (Tab-Arbeitsablauf) ist noch offen.
- Nicht gemacht und bewusst abgelehnt: BPMN-XML-**Import**, Modellvalidierung,
  Mehrseitigkeit, `conditionExpression`, Auto-Layout innerhalb von Pools.
- Ungetestet im großen Maßstab: A*-Routing bei mehr als ~50 Verbindern (kein Caching
  über Verbinder hinweg). Bei 64 Shapes / 57 Verbindern gemessen: konstant 60 fps.
