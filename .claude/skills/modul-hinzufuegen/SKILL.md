---
name: modul-hinzufuegen
description: Anleitung für einen neuen Diagrammtyp (UML, Mindmap, Flussdiagramm, ER …) als eigenes Modul unter src/modules/. Nutzen, wenn eine ganze neue Zeichensprache dazukommt statt nur einzelner Shapes - inklusive der Regel, dass dafür keine einzige Zeile in src/core/ geändert werden darf.
---

# Neues Diagramm-Modul anlegen

Ein neuer Diagrammtyp ist der Belastungstest für das zentrale
Architekturprinzip: **`src/core/` darf nichts über ein Modul wissen.** Das
Wireframe-Modul wurde genau dafür gebaut und hat bewiesen, dass es geht -
angedockt ohne eine einzige Core-Änderung.

> **Abbruchkriterium:** Wenn eine geplante Änderung an `src/core/` einen
> Fachbegriff des neuen Diagrammtyps braucht (in Code *oder* Kommentar),
> gehört sie nicht dorthin. Dann fehlt im Core ein *generisches*
> Verhaltens-Flag - so entstanden `isContainer`, `isAttachable`,
> `collapsedSize`. Ein solches Flag darf ergänzt werden, ein Sonderfall nie.

## Verzeichnis-Muster

```
src/modules/<typ>/
├── index.ts                 register<Typ>Module() - EINZIGER Kontaktpunkt zum Core
├── shapes/                  React-Komponenten + register…()-Aufrufe, constants.ts
├── connectors/              <Typ>ConnectorTypes.ts
└── io/staticSvg.ts          Darstellung für den Bild-Export
```

`modules/wireframe/` ist die passende Vorlage (jünger und sauberer als
`modules/bpmn/`, das noch modul-eigene XML-Exporte mitbringt).

## Die fünf Schritte

1. **`index.ts`** schreiben - ruft alle `register…Shapes()`, die
   Verbindungstyp-Registrierung und den Export-Renderer auf:

   ```ts
   export function registerXyzModule() {
     registerXyzShapes();
     registerXyzConnectorTypes();
     ShapeRegistry.setStaticSvgRenderer("Mein Diagrammtyp", renderXyzShapeToStaticSvg);
   }
   ```

2. **In `App.tsx` aufrufen** - neben `registerBpmnModule()` und
   `registerWireframeModule()`. Das ist die einzige Datei außerhalb des
   Moduls, die es überhaupt beim Namen nennt.

3. **`drawingType`** wählen: ein Anzeige-String (z.B. `"UML"`), der zugleich
   die oberste Toolbox-Ebene *und* der Schlüssel des Export-Renderers ist. Der
   Core verzweigt nie auf seinen Wert.

4. **Shape-Typen** anlegen - je Typ die Pflichtstellen aus dem Skill
   `shape-hinzufuegen` abarbeiten (React-Komponente, `io/staticSvg.ts`,
   `ToolboxIcon.tsx`).

5. **`npm run verify`** - `check:export` nimmt die neuen Typen automatisch
   auf, weil es die Toolbox ausliest, nicht eine Liste.

## Was der Core schon generisch kann

Vor dem Erweitern prüfen, ob es das gesuchte Verhalten bereits gibt:

| Bedarf | Vorhandenes Core-Mittel |
|---|---|
| Element enthält andere | `ShapeDefinition.isContainer` + `core/canvas/containment.ts` |
| Element klebt am Rand eines anderen | `isAttachable` + `core/canvas/attachmentGeometry.ts` |
| Ein-/ausklappbar | `collapsedSize` / `expandedSize` |
| Freie Andockpunkte am Rand | `connectorGeometry.ts`, `free:`-Ports (Z-07) |
| Linienstil, Pfeilspitzen, Routing | `ConnectorTypeRegistry` + `ConnectorStyle` |
| Rotation, Spiegelung, Deckkraft, Schatten | `ShapeStyle` (wird generisch angewendet) |
| Füll-/Linienfarbe aus dem Stil-Panel | `resolve*`-Helfer im **Modul** (`shapes/constants.ts`) |

Letzte Zeile beachten: Der Core *speichert* die Stil-Overrides, angewendet
werden `fillColor`/`strokeColor`/`strokeWidth`/`dashStyle` aber vom Shape des
Moduls selbst.

## Export-Formate

Ein neues Modul erbt SVG, PNG, JSON, Drucken/PDF automatisch. Fachliche
Exporte (wie BPMN-2.0-XML) liegen bewusst im jeweiligen Modul unter `io/` und
werden im `ExportMenu` verdrahtet. Dort gilt das Muster von `summarizeBpmnCoverage()`:
Enthält das Diagramm kein einziges Element, das dieses Format abbilden kann,
den Download gar nicht erst anbieten, sondern erklären, warum.
