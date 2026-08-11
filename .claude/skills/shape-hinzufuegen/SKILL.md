---
name: shape-hinzufuegen
description: Checkliste für einen neuen Shape-Typ (oder das Ändern eines bestehenden) im BPMN-Editor. Nutzen, sobald ein Element auf der Zeichenfläche neu entsteht, umbenannt, umgezeichnet oder entfernt wird - die Darstellung ist an vier Stellen dupliziert, und ein vergessener Ort erzeugt keinen Fehler, sondern still eine falsche Ausgabe.
---

# Neuen Shape-Typ anlegen

Die Optik jedes Shapes existiert im Projekt **drei- bis viermal unabhängig
voneinander**. Das ist eine bewusste, dokumentierte Entscheidung (siehe
CLAUDE.md, „Export-Renderer sind unabhängige Re-Implementierungen") und das
größte Wartungsrisiko der Codebasis: Wer eine Stelle vergisst, bekommt keinen
Compilerfehler, sondern eine stillschweigend falsche Ausgabe in genau einem
Kanal.

## Die vier Pflichtstellen

| # | Datei | Wirkt auf | Pflicht |
|---|---|---|---|
| 1 | `src/modules/<modul>/shapes/<Datei>.tsx` | Zeichenfläche (React) | immer |
| 2 | `src/modules/<modul>/io/staticSvg.ts` | SVG-/PNG-/Druck-Export | immer |
| 3 | `src/ui/Toolbox/ToolboxIcon.tsx` | Toolbox-Vorschau (28×28) | immer |
| 4 | `src/modules/bpmn/io/bpmnXmlExport.ts` → `bpmnTagFor()` | BPMN-2.0-XML-Export | nur echte BPMN-Flusselemente |

Zu 4: Ein früherer realer Fehler - ein Shape fehlte komplett im XML-Export,
weil `bpmnTagFor()` nicht ergänzt wurde. Wireframe-Shapes haben hier bewusst
nichts zu suchen.

## Ablauf

### 1. React-Komponente + Registrierung

Muster (`modules/bpmn/shapes/DataObjectShape.tsx` ist die kürzeste Vorlage):

```tsx
function XyzRender({ shape, isSelected }: ShapeRenderProps) {
  const stroke = isSelected ? BPMN_COLORS.strokeSelected : resolveStroke(shape, BPMN_COLORS.stroke);
  const strokeWidth = isSelected ? 2 : resolveStrokeWidth(shape, 1.5);
  return (
    <g transform={`translate(${shape.position.x} ${shape.position.y})`}>
      {/* ... */}
    </g>
  );
}

export function registerXyzShape() {
  ShapeRegistry.register({
    type: "bpmn.xyz",          // opaker String, den der Core NIE interpretiert
    drawingType: "BPMN 2.0",   // oberste Toolbox-Ebene = Schlüssel des Export-Renderers
    category: "Datenobjekte",  // zweite Toolbox-Ebene
    label: "Anzeigename",      // = `title` der Toolbox-Kachel (wichtig für Browser-Tests)
    defaultSize: { width: 100, height: 80 },
    ports: [ /* relativePosition 0..1 */ ],
    defaultData: { label: "…" },
    render: XyzRender,
  });
}
```

Die `register…()`-Funktion muss in der `index.ts` des Moduls aufgerufen werden -
das ist der einzige Kontaktpunkt zum Core.

Pflicht bei den Farben: `resolveFill` / `resolveStroke` / `resolveStrokeWidth` /
`resolveDashArray` aus `shapes/constants.ts` benutzen, sonst ignoriert das Shape
die Stil-Panel-Overrides (Z-15).

### 2. Export-Renderer im Modul

`modules/<modul>/io/staticSvg.ts` erweitern - reine String-Erzeugung, kein DOM,
kein React. Gemeinsame Bausteine kommen aus
`core/io/staticSvgPrimitives.ts` (`escapeXml`, `multilineTextMarkup`).

**Die häufigste Abweichungsursache ist nicht die Geometrie, sondern der Text:**
`centerVertically` und `anchor` müssen exakt den Werten der Live-Komponente
entsprechen. Linksbündige Beschriftungen rutschen sonst im Export in die Mitte.

Für **Wireframe**-Shapes gilt zusätzlich: Umrisse über dieselben `sketch*`-Primitive
wie live erzeugen (identische Pfaddaten, einmal JSX, einmal String) und
`sketchPathsToSvgString(paths, shape)` mit `shape` aufrufen - nur dann greifen die
Stil-Overrides. Füllfarbe: `fillStyle: "solid"` nicht vergessen, sonst wird aus
der Füllung eine Schraffur.

### 3. Toolbox-Icon

`ToolboxIcon.tsx`, 28×28-Raster, helle Platte als Hintergrund (bleibt in beiden
Themes papierhell - sonst wird das Icon im Dunkelmodus unsichtbar).

### 4. Prüfen

```bash
cd bpmn-editor-source && npm run verify
```

`npm run verify` = Lint + Build + `check:export`. Letzteres legt jeden
registrierten Typ im echten Browser ab und vergleicht Bildschirm gegen
SVG-Export **pixelweise**; Abweichung > 4 % der Tintenpixel = Exit-Code 1.
Genau dieser Test hätte jeden der 2026 gefundenen Export-Fehler sofort
gemeldet. Er ersetzt aber keinen Blick auf das Toolbox-Icon - das prüft er
nicht.

Zum Ausliefern anschließend `npm run ship` (baut, prüft und kopiert
`dist/index.html` über die Wurzeldatei `index.html`).

## Fallstricke

- **Boundary Events** (`isAttachable`) lassen sich nicht frei ablegen und werden
  von `check:export` übersprungen - solche Typen von Hand im Browser ansehen.
- **Container** (`isContainer`, Pools/Lanes) haben keine Ports und werden bei der
  Ziel-Auflösung von Verbindungen bewusst übersprungen.
- Ein neuer `drawingType` bedeutet ein neues Modul → dafür den Skill
  `modul-hinzufuegen` verwenden.
