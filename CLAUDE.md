# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Current state of this repository

**Important: the git repository (`mbosse73/draw-app`) currently contains only the built
artifact and documentation — not the source project.** A fresh clone holds:

- `bpmn-editor.html` — the **built, single-file production artifact** (minified,
  React 19 + Zustand + all app code inlined by `vite-plugin-singlefile`), i.e. a copy of
  `bpmn-editor-source/dist/index.html`. This is the deliverable actually given to the end
  user (opened directly by double-click, no server) — **never hand-edit it**, and never
  try to reverse-engineer or patch the minified bundle. It is only ever replaced by a
  fresh build from the source project.
- `Lastenheft-Zeichenwerkzeuge.md` — requirements spec (German) for drawing-surface and
  drawing-tool improvements, derived from a feature comparison with draw.io. Each
  requirement (Z-01 … Z-19) states the observed current behavior with code references
  and a priority (Muss/Soll/Kann). Its recommendation: the best effort/value next steps
  are Z-06 (directional hover arrows to create connected shapes), Z-01/Z-03 (8-point
  resize handles incl. multi-select) and Z-16 (zoom-to-fit). Consult it before working
  on canvas/tool features.
- `CLAUDE.md` — this file.
- `README.md` — currently just the project name.

- `bpmn-editor-source/` — the actual Vite/React/TypeScript source project. **This is
  where all real development happens** (run `npm install` / `npm run dev` / `npm run
  build` from inside it — see Build & run below), but it exists only on the maintainer's
  machine and **has not been committed to this repository yet**. If it is absent in your
  checkout, source-level changes are impossible — say so explicitly rather than
  attempting to edit `bpmn-editor.html`; the architecture sections below then serve as
  reference for answering questions about the app.
- `BPMN-Editor-Technische-Dokumentation.md` — a detailed technical handoff document (in
  German) describing the architecture in depth; also not committed to this repository
  (referenced here for when it is present locally).

After changing `bpmn-editor-source/src/`, rebuild and copy `dist/index.html` back over
the top-level artifact:

```bash
# bash
cd bpmn-editor-source && npm run build
cp dist/index.html ../bpmn-editor.html
```

```powershell
# PowerShell (maintainer's machine is Windows)
cd bpmn-editor-source; npm run build
Copy-Item dist/index.html ../bpmn-editor.html -Force
```

## Project summary (from the technical documentation)

A browser-based, **fully offline** BPMN 2.0 diagram editor. The shipped artifact is a
single HTML file opened directly in a browser — no server, no install, no network at
runtime. The dev stack (when the source exists) is normal web tooling:

| Area | Choice |
|---|---|
| Framework | React 19, TypeScript |
| Rendering | SVG (no Canvas/WebGL) |
| State | Zustand 5 |
| Build | Vite 8 + `vite-plugin-singlefile` (bundles everything into one `dist/index.html`) |
| Styling | Single `App.css`, CSS custom properties as design tokens |
| Persistence | IndexedDB (auto-save), `localStorage` (favorites), File System Access API (optional backup folder, Chromium-only) |

Runtime deps: `react`, `react-dom`, `zustand`, plus **`roughjs`** (added for the
Desktop-Wireframes module's hand-sketched rendering — a deliberate, documented
exception, see `modules/wireframe/shapes/sketch.ts` and doc section 4.7). Deliberately **no** diagramming
library (e.g. `bpmn-js`) — all rendering and interaction logic is custom, per the
original spec. There is **no automated test suite**; verification historically happened
via throwaway `npx tsx <script>.ts` scripts run directly in Node (Zustand and core logic
are DOM-independent), deleted after use.

### Build & run

All commands run from inside `bpmn-editor-source/`:

```bash
npm install
npm run dev      # dev server, http://localhost:5173
npm run build    # production build -> dist/index.html (the single-file deliverable)
npm run preview  # test the production build locally
```

After `npm run build`, copy `dist/index.html` over the top-level `../bpmn-editor.html`
to actually ship the change (see above) — the two are otherwise out of sync.

## Core architectural principle: core/plugin separation

> **`src/core/` must never know anything BPMN-specific.** All BPMN content lives
> exclusively under `src/modules/bpmn/`.

This is a functional requirement, not a style preference: future diagram types (UML,
mind maps, flowcharts) should be addable as new modules under `src/modules/<type>/`
**without touching `src/core/`**. The core only knows generic concepts that modules give
meaning to:

- `ShapeInstance.type: string` — an opaque string (e.g. `"bpmn.task.user"`) that core
  never interprets itself; it looks up behavior via `ShapeRegistry`.
- `ShapeDefinition.isContainer` / `.collapsedSize`/`.expandedSize` / `.isAttachable` —
  generic behavior flags ("acts like a container", "collapsible", "attachable") with no
  BPMN meaning baked into core.
- `ShapeDefinition.drawingType` — top-level toolbox hierarchy label. Two real modules
  now register against it: `"BPMN 2.0"` and `"Desktop-Wireframes"` (the latter added
  specifically to prove — and now confirm — that a second module drops in with zero
  core changes). Display-only, core never branches on its value.
- `ConnectorInstance.connectorType: string` — analogous to shape type, resolved via
  `ConnectorTypeRegistry`.

**Litmus test for any change to `src/core/`:** if it needs a BPMN term (Task, Gateway,
Pool, sequence flow, ...) in code or comments, it belongs in `src/modules/bpmn/` instead.
This was enforced deliberately when adding sub-processes and boundary events — container/
attachment logic stayed generic in `core/canvas/containment.ts` and
`core/canvas/attachmentGeometry.ts` rather than being special-cased in `CanvasEngine.tsx`.

## Source tree structure (under `bpmn-editor-source/src/`)

```
src/
├── App.tsx / App.css / main.tsx     App root, module registration, single stylesheet
├── core/                            Generic engine — NO BPMN knowledge allowed
│   ├── shapes/                      types.ts, ShapeRegistry.ts, ConnectorTypeRegistry.ts
│   ├── state/                       canvasStore.ts (central Zustand store, ~495 lines),
│   │                                 history.ts (undo/redo), useHistoryStatus.ts, clipboard.ts
│   ├── canvas/                      CanvasEngine.tsx (~990 lines, THE central file — see below),
│   │                                 ConnectorLayer.tsx, ShapePorts.tsx, ResizeHandle.tsx,
│   │                                 GridLayer.tsx, AlignmentGuidesLayer.tsx, MultilineText.tsx,
│   │                                 connectorGeometry.ts, connectorPath.ts, pathRouting.ts (A*),
│   │                                 containment.ts, attachmentGeometry.ts, alignmentGuides.ts,
│   │                                 autoLayout.ts
│   └── io/                          diagramSerializer.ts, fileIo.ts, imageExport.ts, autosave.ts,
│                                     useAutosave.ts, fileSystemBackup.ts
├── modules/bpmn/                    The (only) diagram module
│   ├── index.ts                     registerBpmnModule() — sole contact point with core
│   ├── shapes/                      EventShapes, TaskShapes, GatewayShapes, DataObjectShape,
│   │                                 PoolLaneShapes, SubProcessShape, BoundaryEventShape, TextShape
│   ├── connectors/                  BpmnConnectorTypes.ts
│   └── io/                          bpmnXmlExport.ts (BPMN 2.0 XML serialization)
└── ui/                               Presentation layer; may import both core and modules
    ├── Toolbox/, Toolbar/, PropertiesPanel/, Autosave/, Help/
```

## Key architectural decisions and gotchas

### CanvasEngine.tsx is the interaction state machine

All mouse interactions (move, marquee select, resize, connector drag, reconnect,
waypoint drag, pan) run through three handlers (`handleMouseDown`, `handleMouseMove`,
`handleMouseUp`) that branch on **mutually-exclusive React refs** (not state, to avoid
re-renders mid-drag): `draggingShapeId`, `dragGroupIds`, `resizingShapeId`,
`draggingWaypoint`, `isDraggingConnector`, `isReconnecting`, `isSelecting`. There is no
explicit mode enum — this ref-exclusivity *is* the state machine, just not modeled as
one. Before splitting this file up, understand which refs exclude which; a prior
decision was made to keep it as one file specifically because splitting risks breaking
this implicit invariant. Only split it for a clearly-scoped new interaction, not for
code-hygiene reasons.

Multi-select drag moves all selected shapes together via `moveShapesBy`, with alignment
snapping relative only to the first-grabbed shape (the "anchor"). Container children and
attached boundary events move recursively (`collectDescendantIds`,
`repositionAttachedShapes` in `canvasStore.ts`). During multi-select drag
(`isBulkDragging`), the expensive A* routing is skipped in favor of the simple
orthogonal fallback path, then re-snaps to A* on release — a deliberate UX tradeoff.

### Connector routing (`pathRouting.ts`)

A* on its own coarse search grid (`CELL_SIZE = 15`, independent of the display grid),
with obstacle margin (`OBSTACLE_MARGIN = 8`), a turn penalty (0.5/direction change) to
prefer straight lines, and a hard search cap (`MAX_SEARCH_NODES = 8000`) that falls back
to a simple orthogonal path rather than ever failing to render a connector. Path
priority (`connectorPath.ts`, `computeConnectorPath`): manual waypoints > A* > simple
fallback. The A* search space is rebuilt per-connector with no cross-connector caching —
untested at scale (>50 connectors).

### Auto-layout (`autoLayout.ts`)

Deliberately a custom, dependency-free simplified Sugiyama-style layered layout
(no dagre/ELK, per explicit spec): longest-path layering, barycenter heuristic for
ordering within a layer, then layer→X / order→Y positioning. Only lays out top-level
elements (no `parentId` **and** no `attachedToId` — both must be checked; a past bug
filtered only on `parentId` and mis-placed boundary events). Pool/lane contents are
intentionally left untouched to preserve container structure.

### Undo/redo (`history.ts`) is store-subscription based, not manually invoked

Originally `pushHistorySnapshot()` was called manually at ~10 call sites — this was
fragile (undo/redo worked via buttons but not via keyboard shortcuts). The current
approach: `initHistoryAutoTracking()` (called once at module scope in `App.tsx`, not in
`useEffect`) subscribes to `useCanvasStore` and debounces (400ms) a snapshot on any
`shapes`/`connectors` reference change, regardless of which code path caused it. The
scattered manual calls (now aliased to `flushHistorySnapshot()`) remain harmless and are
still used where an immediate commit is needed (e.g. `undo()` always flushes first so no
in-flight change is lost). Snapshot model: a single `currentSnapshot` plus
`undoStack`/`redoStack` arrays — the *old* snapshot is pushed to the stack before the new
live state becomes current (get this ordering backwards and you get an off-by-one that
was hit once already). Viewport (zoom/pan) and selection are deliberately **not**
captured by history.

### Export renderers are independent re-implementations — the single biggest maintenance risk

`imageExport.ts` (SVG/PNG export) and `ToolboxIcon.tsx` (toolbox preview) each
**re-implement** the visual rendering of every shape type from scratch, independent of
the real React components in `modules/bpmn/shapes/*.tsx`. Using
`react-dom/server`'s `renderToStaticMarkup()` to reuse the real components was tried and
abandoned — it broke in the Node-based (`npx tsx`, no browser DOM) verification
environment and couldn't be reliably confirmed in-browser without risk.

**Consequence: any new shape type needs manual triple (or quadruple) upkeep:**
1. The real React component
2. `imageExport.ts` → `renderShapeToStaticSvg()`
3. `ToolboxIcon.tsx`
4. If it's its own BPMN flow element: `modules/bpmn/io/bpmnXmlExport.ts` → `bpmnTagFor()`
   (a real past bug: a shape was missing from XML export entirely because of this)

Forgetting any of these does not error — it silently produces a wrong/missing element in
that one output. When adding or changing a shape type, update all four sites.

**This is solved for the wireframe module specifically** (not retrofitted onto BPMN):
`modules/wireframe/shapes/sketch.ts` wraps `roughjs`'s `rough.generator()` as pure,
DOM-free functions (`sketchRect`, `sketchLine`, `sketchCircle`, `sketchPath`, all seeded
via `seedFor(shapeId, discriminator)` for deterministic, non-flickering "wobble") that
return identical path data to both the live JSX renderer (`<SketchPaths>`) and
`imageExport.ts`'s string-based `renderWireframeShapeToStaticSvg()`. The actual "what
does this shape look like" logic exists exactly once per shape type; only the
three-site *registration* remains (now mechanical, not error-prone). If BPMN's shapes
are ever migrated to a similar shared-primitive pattern, treat that as a separate,
larger effort — it hasn't been done retroactively.

### Persistence: three independent, unsynchronized mechanisms

| Mechanism | Storage | Contents | Purpose |
|---|---|---|---|
| Auto-save | IndexedDB (`autosave.ts`) | Whole diagram | Data-loss protection, ~every 15s |
| Manual save/open | File download (`diagramSerializer.ts`) | Whole diagram + optional favorites | Deliberate save/share |
| Favorites | `localStorage` (`favoritesStore.ts`) | Favorite markings only | Device-wide UI preference across diagrams |
| Settings file | File download (`settingsIO.ts`) | Favorites only | Transfer to another machine |

Favorites merge **additively** (`mergeFavorites`) when loaded from a diagram/settings
file — loading someone else's diagram must never wipe your own favorites.
`core/io/` must not depend on `ui/Toolbox/favoritesStore.ts` (architecture rule), so
`serializeDiagram(favoriteTypes?: Set<string>)` takes favorites as an optional parameter
that the calling UI layer (`SaveLoadButtons.tsx`, `ExportMenu.tsx`) reads from the
favorites store and passes in.

### Design tokens vs. hardcoded SVG colors

`App.css` follows `UI-DESIGNGUIDE.md` (a level above this project directory): dark
glassmorphism by default, switchable flat-light mode, everything derived from one
`--tint` base variable via `rgba(var(--tint), X)`. Toggle via `ThemeToggleButton`
(toolbar) or `Alt+M`; theme persists in `localStorage["bpmnEditorTheme"]` and is applied
flicker-free by an inline script in `index.html`'s `<head>` before the first React
render — `ui/Theme/themeStore.ts` must keep reading that same key.

The canvas background (`--canvas-bg`/`--canvas-grid-dot`) deliberately does **not**
follow `--tint` — it stays paper-light in both themes, since `imageExport.ts` always
exports on a white background and BPMN's thin black-on-white notation would be hard to
read on a dark canvas. `modules/bpmn/shapes/constants.ts` (`BPMN_COLORS`) and the
hardcoded hex values in `imageExport.ts` still do **not** read from CSS custom
properties (inline SVG styles can't easily reach into `App.css`) — except
`BPMN_COLORS.strokeSelected`, which is now `var(--accent, ...)` so the selection
highlight tracks the active theme. Any other palette change must still update both
`constants.ts` and `imageExport.ts` by hand.

Toolbar dropdowns and the right-click context menu are deliberately plain non-modal
popovers, not native `<dialog>` — only `HelpOverlay`/`ShortcutOverlay` use
`<dialog>` + `showModal()` (via `ui/useModalDialog.ts`), since a modal would wrongly
trap focus for a quick dropdown selection.

`CanvasEngine.tsx`'s wheel handling is a native non-passive `addEventListener("wheel",
..., { passive: false })`, not React's synthetic `onWheel` — needed so
`preventDefault()` reliably blocks Ctrl+wheel/trackpad-pinch from also zooming the
whole browser page (which would look like the toolbar/toolbox/properties panel were
scaling along with the canvas, even though only the canvas's own `<g transform>`
changes). `.canvas-area` also sets `touch-action: none` and `overscroll-behavior: none`,
and suppresses Safari's proprietary `gesturestart`/`gesturechange` events.

## Known keyboard-shortcut gotcha

Ctrl+Z/Ctrl+Y appeared swapped on German QWERTZ keyboards because `e.code` reports the
*physical* US key position (Y/Z are swapped vs. QWERTY). Fix: use `e.key`, not `e.code`,
for letter shortcuts. `e.code` is only safe for keys at the same physical position across
common layouts (A, C, V, G, ...); always use `e.key` for Y/Z.

## Verification without a test suite

There is no test runner in the project. The established approach for isolated logic
(store actions, `pathRouting.ts`, `autoLayout.ts`, `attachmentGeometry.ts`, serializer/
export functions) is a throwaway script run with `npx tsx <script>.ts`, since these are
DOM-independent. There is no way to automate UI-behavior verification in this
environment — that requires user confirmation in an actual browser. Node has no native
`localStorage`; for store tests touching persistence, mock it with a minimal
`getItem`/`setItem` class. Watch ES module hoisting: `import` statements execute before
synchronous code in the same file, so setting mock storage data before an `import`
statement doesn't actually run before store initialization — use dynamic `await
import(...)` after setting up mocks instead.
