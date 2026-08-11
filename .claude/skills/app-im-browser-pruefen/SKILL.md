---
name: app-im-browser-pruefen
description: Rezepte und Fallstricke, um das gebaute Artefakt mit Playwright/Chromium fernzusteuern - Element ablegen, verbinden, Trefferzonen messen, Bildfrequenz messen. Nutzen für jede Prüfung von UI-Verhalten (Maus, Werkzeuge, Interaktion), die npm run check:export nicht abdeckt. Enthält die Irrtümer, die in früheren Sitzungen zu falschen Befunden geführt haben.
---

# Die App im Browser prüfen

`npm run check:export` deckt **nur** Bildschirm-gegen-Export ab. Alles
Interaktive (Ziehen, Verbinden, Selektieren, Trefferzonen) muss von Hand
ferngesteuert werden. Playwright ist bereits als devDependency vorhanden,
Chromium wird automatisch gefunden (siehe `findeChromium()` in
`scripts/check-export.mjs`).

Wegwerf-Skript in den Scratchpad-Ordner schreiben, mit `node <datei>.mjs`
laufen lassen, danach löschen. **Nicht** ins Repository committen.

```js
import { chromium } from "playwright";
const browser = await chromium.launch({ executablePath: process.env.CHECK_EXPORT_CHROMIUM });
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
page.on("pageerror", (e) => console.log("SEITENFEHLER:", e.message));
await page.goto("file:///home/user/draw-app/bpmn-editor-source/dist/index.html");
await page.waitForTimeout(900);
```

Immer gegen `dist/index.html` prüfen, also **nach** `npm run build` - das ist
der Stand, der ausgeliefert wird.

## Fünf Irrtümer, die schon zu falschen Befunden geführt haben

1. **Erfundene Toolbox-Titel.** „Aufgabe", „Schaltfläche", „Eingabefeld"
   existieren nicht; korrekt sind `Task`, `Standard-Button`, `Textfeld`. Der
   `title` einer Kachel ist exakt das `label` der `ShapeDefinition`. Nie raten -
   erst auslesen:
   ```js
   await page.$$eval(".toolbox-item", (l) => l.map((e) => e.title));
   ```
2. **Zugeklappte Kategorien.** Kacheln in eingeklappten Kategorien existieren
   nicht im DOM. Vorher aufklappen:
   ```js
   for (let i = 0; i < 4; i++) {
     const zu = page.locator('.toolbox-category-header[aria-expanded="false"]');
     const n = await zu.count(); if (!n) break;
     for (let k = n - 1; k >= 0; k--) await zu.nth(k).click({ timeout: 2500 }).catch(() => {});
     await page.waitForTimeout(150);
   }
   ```
3. **Verbindung in der Shape-Mitte losgelassen.** Eine Verbindung dockt an
   Ports und Rändern an. Wer in der Mitte einer großen Shape loslässt, misst
   den Notnagel `findPortOnShapeAtPoint`, nicht den normalen Weg - und hält
   ein Ergebnis für einen Fehler, das keiner ist. Für den Regelfall am Rand
   oder auf einem sichtbaren Port loslassen.
4. **Elementzählung über Positions-Selektoren.** Zwischenebenen verschieben
   die Reihenfolge. Stabil ist ausschließlich die Kennung:
   ```js
   document.querySelectorAll(".canvas-container svg g[data-shape-id]")
   ```
   (`data-shape-id` und `data-shape-type` liegen genau dafür an der Gruppe.)
5. **Zeitmessung über CDP.** Playwright-gesteuerte Mausbewegungen kosten pro
   Schritt 40-50 ms *Protokoll-Overhead*. Das sah einmal wie ein
   Performance-Problem aus, obwohl die App konstant 60 fps lieferte. Immer
   **in der Seite** messen:
   ```js
   await page.evaluate(() => new Promise((res) => {
     const t = []; let n = 0;
     const tick = (ts) => { t.push(ts); if (++n < 60) requestAnimationFrame(tick); else res(t); };
     requestAnimationFrame(tick);
   }));
   ```

## Element ablegen (HTML5-Drag-and-Drop)

Playwrights `dragTo()` funktioniert hier **nicht** - die Toolbox nutzt echtes
HTML5-DnD. Ereignisse mit *demselben* `DataTransfer` von Hand auslösen:

```js
await page.evaluate(({ titel, x, y }) => {
  const el = [...document.querySelectorAll(".toolbox-item")].find((e) => e.title === titel);
  const svg = document.querySelector(".canvas-container svg");
  const dt = new DataTransfer();
  el.dispatchEvent(new DragEvent("dragstart", { bubbles: true, cancelable: true, dataTransfer: dt }));
  const r = svg.getBoundingClientRect();
  const pt = { clientX: r.left + x, clientY: r.top + y, bubbles: true, cancelable: true, dataTransfer: dt };
  svg.dispatchEvent(new DragEvent("dragover", pt));
  svg.dispatchEvent(new DragEvent("drop", pt));
}, { titel: "Task", x: 340, y: 260 });
```

Der Typ steckt in `dt.getData("application/shape-type")`. Frisch abgelegte
Elemente sind automatisch selektiert.

## Trefferzonen messen statt schätzen

SVG kennt kein `z-index` - wer zuletzt gezeichnet wird, gewinnt den Klick.
Genau daraus entstanden zwei reale Fehler (F-11). Wer an der Zeichenreihenfolge
in `CanvasEngine.tsx` etwas ändert, misst das Ergebnis entlang einer Achse:

```js
await page.evaluate(({ x, y }) => {
  const out = [];
  for (let d = -14; d <= 14; d++) {
    const el = document.elementFromPoint(x + d, y);
    out.push([d, el?.tagName, getComputedStyle(el).cursor]);
  }
  return out;
}, { x: portX, y: portY });
```

Erwartung am Verbindungs-Port: durchgehend `crosshair` von −8 bis +8, der Ring
des Hover-Pfeils erst ab +10.

## Weitere brauchbare Griffe

| Zweck | Selektor / Griff |
|---|---|
| Menüleiste | `.menubar-trigger` (Text „Datei"), dann `.menubar-dropdown button`, Flyout `.menu-flyout button` |
| Alles löschen | Klick auf leere Fläche, `Control+a`, `Delete` |
| Download abfangen | `page.waitForEvent("download")` parallel zum Klick |
| Dialoge | `page.on("dialog", (d) => d.accept())` |
| Theme | `Alt+M` oder `localStorage["bpmnEditorTheme"]` |

Undo/Redo immer über `e.key` denken, nicht über `e.code`: Auf QWERTZ meldet
`e.code` die *physische* US-Position, dadurch wirkten Strg+Z/Strg+Y einmal
vertauscht.
