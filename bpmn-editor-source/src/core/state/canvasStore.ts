import { create } from "zustand";
import type { ShapeInstance, ConnectorInstance, ConnectorStyle, ShapeStyle, Point, Size } from "../shapes/types";
import { getAttachedPosition } from "../canvas/attachmentGeometry";

/** Eine per Lineal gezogene Hilfslinie (Z-17), persistiert bis explizit entfernt. */
export interface Guide {
  id: string;
  axis: "horizontal" | "vertical";
  /** Weltkoordinate: Y für horizontal, X für vertikal. */
  position: number;
}

/** Ausrichtungsmodi für `alignShapes` - Bedeutung analog zu draw.io/PowerPoint. */
export type AlignMode = "left" | "centerH" | "right" | "top" | "middleV" | "bottom";

export interface Viewport {
  x: number; // Pan-Offset X in Canvas-Koordinaten
  y: number; // Pan-Offset Y
  zoom: number; // 1 = 100%
}

/** Zustand während des aktiven Ziehens einer neuen Verbindung. */
export interface ConnectorDraft {
  sourceShapeId: string;
  sourcePortId: string;
  currentPoint: Point; // aktuelle Mausposition in Weltkoordinaten
}

/** Zustand während ein bestehender Verbindungs-Endpunkt neu angedockt wird. */
export interface ReconnectDraft {
  connectorId: string;
  end: "source" | "target";
  currentPoint: Point;
}

/** Zustand während eines aktiven Auswahlrechtecks (Rubber-Band-Selection). */
export interface SelectionRect {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

interface CanvasState {
  viewport: Viewport;
  shapes: Record<string, ShapeInstance>;
  connectors: Record<string, ConnectorInstance>;
  selectedShapeIds: string[];
  selectedConnectorId: string | null;
  gridSize: number;
  snapEnabled: boolean;
  hoveredShapeId: string | null;
  connectorDraft: ConnectorDraft | null;
  reconnectDraft: ReconnectDraft | null;
  selectionRect: SelectionRect | null;
  /** Zuletzt bekannte Pixelgröße der sichtbaren Zeichenfläche (von CanvasEngine
   *  per ResizeObserver aktuell gehalten) - wird für zoomToFit/zoomToSelection
   *  gebraucht, da der Store selbst kein DOM kennt (Z-16). */
  viewportSize: { width: number; height: number };
  /** Per Lineal gezogene, persistente Hilfslinien (Z-17). */
  guides: Guide[];
  /** Ob die gestrichelte Druckseiten-Vorschau eingeblendet ist (Z-18). */
  showPagePreview: boolean;
  /** Vom Formatpinsel (Z-14) kopierter visueller Stil, wartet auf Anwendung
   *  per Klick auf ein Ziel-Element. Getaggte Variante statt einem simplen
   *  Partial<ShapeStyle>, weil der Formatpinsel sowohl von Shapes als auch
   *  von Verbindungen kopieren/auf sie anwenden kann - beide haben eigene,
   *  inkompatible Stil-Typen (ShapeStyle vs. ConnectorStyle), `kind`
   *  entscheidet beim Anwenden, ob das Ziel überhaupt passt. Bei Shapes
   *  werden nur die rein visuellen ShapeStyle-Felder kopiert (nicht
   *  Rotation/Spiegelung/Position). */
  formatPainterClipboard:
    | { kind: "shape"; style: Partial<ShapeStyle> }
    | { kind: "connector"; style: Partial<ConnectorStyle> }
    | null;
  /** Titel/Stichwörter DIESER Zeichnung (nicht einzelner Shapes) - wird beim
   *  Speichern in die Datei geschrieben und beim Laden daraus übernommen
   *  (siehe diagramSerializer.ts). Grundlage für die Bibliotheks-Suche. */
  diagramMeta: { title: string; keywords: string[] };
  setDiagramTitle: (title: string) => void;
  setDiagramKeywords: (keywords: string[]) => void;

  // Viewport-Aktionen
  setViewport: (viewport: Partial<Viewport>) => void;
  zoomAt: (screenX: number, screenY: number, delta: number) => void;
  pan: (dx: number, dy: number) => void;
  setViewportSize: (size: { width: number; height: number }) => void;
  /** Zoomt/pant so, dass alle Shapes sichtbar sind (Z-16). Ohne Shapes: no-op. */
  zoomToFit: () => void;
  /** Zoomt/pant auf die Bounding-Box der aktuellen Auswahl (Z-16). Ohne Auswahl: no-op. */
  zoomToSelection: () => void;

  // Shape-Aktionen
  addShape: (shape: ShapeInstance) => void;
  updateShape: (id: string, changes: Partial<ShapeInstance>) => void;
  removeShape: (id: string) => void;
  moveShape: (id: string, position: { x: number; y: number }, skipGridSnap?: boolean) => void;
  /** Verschiebt mehrere Shapes gemeinsam um denselben Versatz (für Mehrfachauswahl). */
  moveShapesBy: (ids: string[], delta: { x: number; y: number }) => void;
  resizeShape: (id: string, size: { width: number; height: number }) => void;
  /** Wie resizeShape, setzt aber zusätzlich die Position - nötig für Resize-Griffe,
   *  die nicht an der unten-rechts-Ecke verankert sind (Z-01: alle 8 Punkte). */
  resizeShapeWithPosition: (id: string, position: Point, size: Size) => void;
  /** Skaliert mehrere Shapes gemeinsam relativ zu einem festen Ursprungspunkt
   *  (typischerweise die dem gezogenen Griff gegenüberliegende Ecke der
   *  Auswahl-Bounding-Box) - für Mehrfachauswahl-Resize (Z-03).
   *  `originalGeometry` ist die Position/Größe jeder Shape VOM DRAG-START
   *  (nicht der aktuelle Store-Zustand!) - wird bei jedem mousemove erneut
   *  mit demselben, am Anfang der Geste eingefrorenen `scaleX`/`scaleY`
   *  relativ zum ORIGINAL aufgerufen. Absichtlich kein "skaliere den
   *  aktuellen Zustand nochmal" - das würde bei mehreren aufeinander-
   *  folgenden Aufrufen (ein Drag erzeugt viele mousemove-Events)
   *  multiplikativ compounden, siehe Bugfix-Notiz in
   *  BPMN-Editor-Technische-Dokumentation.md Abschnitt 6. */
  resizeShapesScaled: (
    ids: string[],
    originalGeometry: Record<string, { position: Point; size: Size }>,
    origin: Point,
    scaleX: number,
    scaleY: number
  ) => void;
  /** Spiegelt die übergebenen Shapes horizontal/vertikal (Z-04). Bei einer
   *  einzelnen Shape wird nur ihr eigenes flipX/flipY umgeschaltet (Spiegelung
   *  in place); bei mehreren wird zusätzlich die Position jeder Shape an der
   *  gemeinsamen Bounding-Box-Achse gespiegelt, damit sich die Anordnung der
   *  Gruppe mitspiegelt (wie in draw.io/PowerPoint). */
  flipShapes: (ids: string[], axis: "horizontal" | "vertical") => void;
  /** Setzt/löst die Positions-/Größen-/Rotationssperre einer Shape (Z-05). */
  setShapeLocked: (id: string, locked: boolean) => void;
  /** Blendet eine Shape aus/ein (Z-05). */
  setShapeHidden: (id: string, hidden: boolean) => void;
  /** Blendet alle ausgeblendeten Shapes wieder ein (Z-05, da einzeln
   *  ausgeblendete Shapes nicht mehr direkt anklickbar sind). */
  unhideAllShapes: () => void;
  /** Passt Breite/Höhe/beides aller übergebenen Shapes an die erste Shape
   *  in `ids` an (Z-13, "Match Size"). Angeheftete Shapes werden übersprungen. */
  matchShapeSizes: (ids: string[], mode: "width" | "height" | "both") => void;
  /** Kopiert die rein visuellen Stil-Felder einer Shape für den Formatpinsel (Z-14). */
  copyFormatFromShape: (id: string) => void;
  /** Kopiert Linienstil/Pfeilspitzen/Pfadstil einer Verbindung für den Formatpinsel. */
  copyFormatFromConnector: (id: string) => void;
  /** Wendet den zuvor kopierten Formatpinsel-Stil auf die übergebenen Shapes an
   *  und beendet den Formatpinsel-Modus. No-op, falls das Clipboard leer ist
   *  oder von einer Verbindung stammt (falscher `kind`). */
  applyFormatPainterToShapes: (targetIds: string[]) => void;
  /** Wie applyFormatPainterToShapes, aber für Verbindungen. */
  applyFormatPainterToConnectors: (targetIds: string[]) => void;
  cancelFormatPainter: () => void;
  /** Setzt die Rotation (Grad, im Uhrzeigersinn) einer Shape; wird auf 0-359 normalisiert. */
  setShapeRotation: (id: string, rotation: number) => void;
  /** Richtet die übergebenen Shapes relativ zur gemeinsamen Bounding-Box aus
   *  (angeheftete Shapes werden übersprungen, siehe Store-Implementierung). */
  alignShapes: (ids: string[], mode: AlignMode) => void;
  /** Verteilt die übergebenen Shapes mit gleichmäßigem Abstand entlang einer Achse;
   *  die äußeren beiden bleiben fix, mindestens 3 Shapes nötig. */
  distributeShapes: (ids: string[], axis: "horizontal" | "vertical") => void;
  setShapeParent: (id: string, parentId: string | undefined) => void;
  getChildShapeIds: (parentId: string) => string[];
  /** Fasst die übergebenen Shapes zu einer Gruppe zusammen (überschreibt evtl. vorherige Gruppenzugehörigkeit). */
  groupShapes: (ids: string[]) => void;
  /** Löst die Gruppierung der übergebenen Shapes auf. */
  ungroupShapes: (ids: string[]) => void;
  /** Liefert alle IDs, die zur selben Gruppe gehören wie die übergebene Shape (inkl. ihr selbst), oder nur [id] falls keiner Gruppe zugehörig. */
  getGroupMemberIds: (id: string) => string[];
  pasteShapesAndConnectors: (shapes: ShapeInstance[], connectors: ConnectorInstance[]) => void;

  // Connector-Aktionen
  addConnector: (connector: ConnectorInstance) => void;
  removeConnector: (id: string) => void;
  updateConnectorWaypoints: (id: string, waypoints: Point[]) => void;
  setConnectorLabel: (id: string, label: string) => void;
  /** Setzt den freien Drag-Versatz des Verbinder-Labels gegenüber dem Verbindungsmittelpunkt. */
  setConnectorLabelOffset: (id: string, offset: Point) => void;
  startConnectorDraft: (sourceShapeId: string, sourcePortId: string, point: Point) => void;
  updateConnectorDraft: (point: Point) => void;
  cancelConnectorDraft: () => void;
  startReconnectDraft: (connectorId: string, end: "source" | "target", point: Point) => void;
  updateReconnectDraft: (point: Point) => void;
  cancelReconnectDraft: () => void;
  setConnectorEndpoint: (connectorId: string, end: "source" | "target", shapeId: string, portId: string) => void;
  setConnectorType: (connectorId: string, connectorType: string) => void;
  /** Merged die übergebenen Felder in connector.style (Linienstil/Pfeilspitzen-Overrides). */
  updateConnectorStyle: (connectorId: string, changes: Partial<ConnectorStyle>) => void;
  /** Fügt an gegebener Position einen manuellen Wegpunkt ein (übernimmt Kontrolle vom Auto-Routing). */
  insertManualWaypoint: (connectorId: string, index: number, point: Point) => void;
  moveManualWaypoint: (connectorId: string, index: number, point: Point) => void;
  /** Entfernt einen Wegpunkt; sind danach keine mehr übrig, greift wieder Auto-Routing. */
  removeManualWaypoint: (connectorId: string, index: number) => void;

  // Selection
  selectShape: (id: string | null, additive?: boolean) => void;
  selectShapes: (ids: string[]) => void;
  selectConnector: (id: string | null) => void;
  clearSelection: () => void;
  setHoveredShape: (id: string | null) => void;
  startSelectionRect: (x: number, y: number) => void;
  updateSelectionRect: (x: number, y: number) => void;
  endSelectionRect: () => void;

  // Lineale & Hilfslinien (Z-17)
  addGuide: (axis: "horizontal" | "vertical", position: number) => string;
  moveGuide: (id: string, position: number) => void;
  removeGuide: (id: string) => void;

  // Druckseiten-Vorschau (Z-18)
  togglePagePreview: () => void;
}

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4;

/** Gemeinsame Berechnung für zoomToFit/zoomToSelection (Z-16): passt Zoom/Pan
 *  so an, dass die übergebene Bounding-Box mittig und vollständig sichtbar ist,
 *  mit etwas Rand (PADDING) und geklemmt auf den erlaubten Zoom-Bereich. */
function applyFitViewport(
  set: (partial: Partial<CanvasState>) => void,
  viewportSize: { width: number; height: number },
  box: { minX: number; minY: number; maxX: number; maxY: number }
): void {
  const PADDING = 60;
  const contentWidth = Math.max(1, box.maxX - box.minX);
  const contentHeight = Math.max(1, box.maxY - box.minY);
  const availableWidth = Math.max(1, viewportSize.width - PADDING * 2);
  const availableHeight = Math.max(1, viewportSize.height - PADDING * 2);
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.min(availableWidth / contentWidth, availableHeight / contentHeight)));
  const contentCenterX = (box.minX + box.maxX) / 2;
  const contentCenterY = (box.minY + box.maxY) / 2;
  const x = viewportSize.width / 2 - contentCenterX * zoom;
  const y = viewportSize.height / 2 - contentCenterY * zoom;
  set({ viewport: { x, y, zoom } });
}

/** Rastert einen Wert auf das Grid, falls Snapping aktiv ist. */
export function snapToGrid(value: number, gridSize: number, enabled: boolean): number {
  if (!enabled) return value;
  return Math.round(value / gridSize) * gridSize;
}

/** Sammelt rekursiv alle Nachfahren (direkte und indirekte Kinder über parentId). */
function collectDescendantIds(rootIds: string[], shapes: Record<string, ShapeInstance>): Set<string> {
  const descendantIds = new Set<string>();
  let frontier = rootIds;
  while (frontier.length > 0) {
    const next: string[] = [];
    for (const s of Object.values(shapes)) {
      if (s.parentId && frontier.includes(s.parentId) && !descendantIds.has(s.id)) {
        descendantIds.add(s.id);
        next.push(s.id);
      }
    }
    frontier = next;
  }
  return descendantIds;
}

/**
 * Aktualisiert die Positionen aller Shapes, die an eine der übergebenen
 * Host-IDs angeheftet sind (attachedToId), basierend auf deren aktuellem
 * attachmentRatio und der (bereits aktualisierten) Host-Geometrie. Muss
 * nach jeder Positions- ODER Größenänderung eines möglichen Hosts
 * aufgerufen werden, sonst "lösen" sich Boundary Events optisch vom Rand.
 */
function repositionAttachedShapes(
  shapes: Record<string, ShapeInstance>,
  hostIds: Set<string>
): Record<string, ShapeInstance> {
  const updated = { ...shapes };
  for (const shape of Object.values(shapes)) {
    if (shape.attachedToId && hostIds.has(shape.attachedToId)) {
      const host = updated[shape.attachedToId];
      if (!host) continue;
      updated[shape.id] = { ...shape, position: getAttachedPosition(shape, host) };
    }
  }
  return updated;
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  viewport: { x: 0, y: 0, zoom: 1 },
  shapes: {},
  connectors: {},
  selectedShapeIds: [],
  selectedConnectorId: null,
  gridSize: 20,
  snapEnabled: true,
  hoveredShapeId: null,
  connectorDraft: null,
  reconnectDraft: null,
  selectionRect: null,
  viewportSize: { width: 0, height: 0 },
  guides: [],
  showPagePreview: false,
  formatPainterClipboard: null,
  diagramMeta: { title: "", keywords: [] },

  setDiagramTitle: (title) => set((state) => ({ diagramMeta: { ...state.diagramMeta, title } })),
  setDiagramKeywords: (keywords) => set((state) => ({ diagramMeta: { ...state.diagramMeta, keywords } })),

  setViewport: (viewport) =>
    set((state) => ({ viewport: { ...state.viewport, ...viewport } })),

  setViewportSize: (size) => set({ viewportSize: size }),

  zoomToFit: () => {
    const { shapes, viewportSize } = get();
    const list = Object.values(shapes).filter((s) => !s.hidden);
    if (list.length === 0 || viewportSize.width === 0 || viewportSize.height === 0) return;
    const minX = Math.min(...list.map((s) => s.position.x));
    const minY = Math.min(...list.map((s) => s.position.y));
    const maxX = Math.max(...list.map((s) => s.position.x + s.size.width));
    const maxY = Math.max(...list.map((s) => s.position.y + s.size.height));
    applyFitViewport(set, viewportSize, { minX, minY, maxX, maxY });
  },

  zoomToSelection: () => {
    const { shapes, selectedShapeIds, viewportSize } = get();
    const list = selectedShapeIds.map((id) => shapes[id]).filter((s): s is ShapeInstance => Boolean(s));
    if (list.length === 0 || viewportSize.width === 0 || viewportSize.height === 0) return;
    const minX = Math.min(...list.map((s) => s.position.x));
    const minY = Math.min(...list.map((s) => s.position.y));
    const maxX = Math.max(...list.map((s) => s.position.x + s.size.width));
    const maxY = Math.max(...list.map((s) => s.position.y + s.size.height));
    applyFitViewport(set, viewportSize, { minX, minY, maxX, maxY });
  },

  zoomAt: (screenX, screenY, delta) => {
    const { viewport } = get();
    const factor = delta > 0 ? 0.9 : 1.1;
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, viewport.zoom * factor));

    const worldX = (screenX - viewport.x) / viewport.zoom;
    const worldY = (screenY - viewport.y) / viewport.zoom;
    const newX = screenX - worldX * newZoom;
    const newY = screenY - worldY * newZoom;

    set({ viewport: { x: newX, y: newY, zoom: newZoom } });
  },

  pan: (dx, dy) =>
    set((state) => ({
      viewport: { ...state.viewport, x: state.viewport.x + dx, y: state.viewport.y + dy },
    })),

  addShape: (shape) =>
    set((state) => ({ shapes: { ...state.shapes, [shape.id]: shape } })),

  updateShape: (id, changes) =>
    set((state) => {
      const existing = state.shapes[id];
      if (!existing) return state;
      let updated = { ...state.shapes, [id]: { ...existing, ...changes } };
      // Ändert sich die Größe (z.B. Sub-Prozess-Toggle über updateShape statt
      // resizeShape), müssen angeheftete Shapes (Boundary Events) am neuen
      // Rand neu positioniert werden - sonst "lösen" sie sich optisch ab.
      if (changes.size) {
        updated = repositionAttachedShapes(updated, new Set([id]));
      }
      return { shapes: updated };
    }),

  removeShape: (id) =>
    set((state) => {
      const idsToRemove = new Set<string>([id, ...collectDescendantIds([id], state.shapes)]);
      // Angeheftete Shapes (z.B. Boundary Events) ergeben ohne ihren Host
      // keinen Sinn mehr und werden mitentfernt.
      for (const s of Object.values(state.shapes)) {
        if (s.attachedToId && idsToRemove.has(s.attachedToId)) idsToRemove.add(s.id);
      }

      const shapes = { ...state.shapes };
      idsToRemove.forEach((removeId) => delete shapes[removeId]);

      const connectors = Object.fromEntries(
        Object.entries(state.connectors).filter(
          ([, c]) => !idsToRemove.has(c.sourceShapeId) && !idsToRemove.has(c.targetShapeId)
        )
      );

      return {
        shapes,
        connectors,
        selectedShapeIds: state.selectedShapeIds.filter((s) => !idsToRemove.has(s)),
      };
    }),

  moveShape: (id, position, skipGridSnap = false) => {
    const { gridSize, snapEnabled, shapes } = get();
    const shape = shapes[id];
    if (!shape) return;

    const snapped = skipGridSnap
      ? position
      : {
          x: snapToGrid(position.x, gridSize, snapEnabled),
          y: snapToGrid(position.y, gridSize, snapEnabled),
        };
    const dx = snapped.x - shape.position.x;
    const dy = snapped.y - shape.position.y;
    if (dx === 0 && dy === 0) return;

    // Generisch: alle Nachfahren (direkte und indirekte Kinder über parentId)
    // wandern um denselben Versatz mit. Wichtig bei Pool > Lane > Task, damit
    // beim Verschieben eines Pools auch die Tasks in seinen Lanes mitziehen.
    const descendantIds = collectDescendantIds([id], shapes);

    set((state) => {
      let updated = { ...state.shapes };
      updated[id] = { ...updated[id], position: snapped };
      for (const childId of descendantIds) {
        const child = updated[childId];
        if (!child) continue;
        updated[childId] = {
          ...child,
          position: { x: child.position.x + dx, y: child.position.y + dy },
        };
      }
      // Boundary Events (und künftige angeheftete Shape-Arten) am neuen Rand
      // neu positionieren - sowohl für die verschobene Shape selbst als auch
      // für jeden mitverschobenen Nachfahren, der seinerseits Host sein könnte.
      updated = repositionAttachedShapes(updated, new Set([id, ...descendantIds]));
      return { shapes: updated };
    });
  },

  moveShapesBy: (ids, delta) => {
    if (delta.x === 0 && delta.y === 0) return;
    const { shapes } = get();
    // Auch hier: Nachfahren aller bewegten Elemente (z.B. eine mitselektierte
    // Lane samt Inhalt) müssen mitziehen, ohne doppelt verschoben zu werden.
    const allIds = new Set<string>(ids);
    collectDescendantIds(ids, shapes).forEach((id) => allIds.add(id));

    set((state) => {
      let updated = { ...state.shapes };
      for (const id of allIds) {
        const shape = updated[id];
        if (!shape) continue;
        updated[id] = {
          ...shape,
          position: { x: shape.position.x + delta.x, y: shape.position.y + delta.y },
        };
      }
      updated = repositionAttachedShapes(updated, allIds);
      return { shapes: updated };
    });
  },

  resizeShape: (id, size) =>
    set((state) => {
      const existing = state.shapes[id];
      if (!existing) return state;
      let updated = { ...state.shapes, [id]: { ...existing, size } };
      updated = repositionAttachedShapes(updated, new Set([id]));
      return { shapes: updated };
    }),

  resizeShapeWithPosition: (id, position, size) =>
    set((state) => {
      const existing = state.shapes[id];
      if (!existing) return state;
      let updated = { ...state.shapes, [id]: { ...existing, position, size } };
      updated = repositionAttachedShapes(updated, new Set([id]));
      return { shapes: updated };
    }),

  resizeShapesScaled: (ids, originalGeometry, origin, scaleX, scaleY) => {
    const { shapes } = get();
    const targets = ids.map((id) => shapes[id]).filter((s): s is ShapeInstance => Boolean(s) && !s.attachedToId && !s.locked);
    if (targets.length === 0) return;
    set((state) => {
      let updated = { ...state.shapes };
      for (const s of targets) {
        // WICHTIG: skaliert die vom Drag-Start eingefrorene Original-Geometrie,
        // NICHT s.position/s.size (das wäre der aktuelle, ggf. schon von einem
        // vorherigen mousemove veränderte Zustand) - sonst compoundet der
        // Skalierungsfaktor bei jedem weiteren Aufruf multiplikativ, siehe
        // Store-Interface-Kommentar und Abschnitt 6 der technischen Doku.
        const original = originalGeometry[s.id];
        if (!original) continue;
        const newPosition = {
          x: origin.x + (original.position.x - origin.x) * scaleX,
          y: origin.y + (original.position.y - origin.y) * scaleY,
        };
        const newSize = {
          width: Math.max(24, original.size.width * scaleX),
          height: Math.max(24, original.size.height * scaleY),
        };
        updated[s.id] = { ...updated[s.id], position: newPosition, size: newSize };
      }
      updated = repositionAttachedShapes(updated, new Set(targets.map((s) => s.id)));
      return { shapes: updated };
    });
  },

  flipShapes: (ids, axis) => {
    const { shapes } = get();
    const targets = ids.map((id) => shapes[id]).filter((s): s is ShapeInstance => Boolean(s) && !s.attachedToId && !s.locked);
    if (targets.length === 0) return;

    // Bei Mehrfachauswahl wird zusätzlich die Anordnung an der gemeinsamen
    // Bounding-Box-Achse gespiegelt (wie in draw.io/PowerPoint) - bei einer
    // einzelnen Shape bleibt die Position unverändert, nur ihr eigenes
    // flipX/flipY wird umgeschaltet (Spiegelung "in place").
    const isGroup = targets.length > 1;
    const minX = Math.min(...targets.map((s) => s.position.x));
    const maxX = Math.max(...targets.map((s) => s.position.x + s.size.width));
    const minY = Math.min(...targets.map((s) => s.position.y));
    const maxY = Math.max(...targets.map((s) => s.position.y + s.size.height));

    set((state) => {
      let updated = { ...state.shapes };
      for (const s of targets) {
        const style: ShapeStyle = { ...s.style };
        let position = s.position;
        if (axis === "horizontal") {
          style.flipX = !style.flipX;
          if (isGroup) position = { ...position, x: minX + maxX - s.position.x - s.size.width };
        } else {
          style.flipY = !style.flipY;
          if (isGroup) position = { ...position, y: minY + maxY - s.position.y - s.size.height };
        }
        updated[s.id] = { ...updated[s.id], position, style };
      }
      updated = repositionAttachedShapes(updated, new Set(targets.map((s) => s.id)));
      return { shapes: updated };
    });
  },

  setShapeLocked: (id, locked) =>
    set((state) => {
      const existing = state.shapes[id];
      if (!existing) return state;
      return { shapes: { ...state.shapes, [id]: { ...existing, locked } } };
    }),

  setShapeHidden: (id, hidden) =>
    set((state) => {
      const existing = state.shapes[id];
      if (!existing) return state;
      return {
        shapes: { ...state.shapes, [id]: { ...existing, hidden } },
        selectedShapeIds: hidden ? state.selectedShapeIds.filter((s) => s !== id) : state.selectedShapeIds,
      };
    }),

  unhideAllShapes: () =>
    set((state) => {
      const updated = { ...state.shapes };
      for (const s of Object.values(updated)) {
        if (s.hidden) updated[s.id] = { ...s, hidden: false };
      }
      return { shapes: updated };
    }),

  matchShapeSizes: (ids, mode) => {
    const { shapes } = get();
    const reference = shapes[ids[0]];
    if (!reference) return;
    const targets = ids
      .slice(1)
      .map((id) => shapes[id])
      .filter((s): s is ShapeInstance => Boolean(s) && !s.attachedToId && !s.locked);
    if (targets.length === 0) return;

    set((state) => {
      let updated = { ...state.shapes };
      for (const s of targets) {
        const width = mode === "height" ? s.size.width : reference.size.width;
        const height = mode === "width" ? s.size.height : reference.size.height;
        updated[s.id] = { ...updated[s.id], size: { width, height } };
      }
      updated = repositionAttachedShapes(updated, new Set(targets.map((s) => s.id)));
      return { shapes: updated };
    });
  },

  copyFormatFromShape: (id) => {
    const shape = get().shapes[id];
    if (!shape) return;
    // Nur die rein visuellen Stil-Felder kopieren (Z-14) - Rotation/Spiegelung
    // gehören bewusst NICHT zum "Format" im Sinne eines Formatpinsels.
    const { fillColor, strokeColor, strokeWidth, dashStyle, opacity, shadow } = shape.style ?? {};
    set({
      formatPainterClipboard: {
        kind: "shape",
        style: { fillColor, strokeColor, strokeWidth, dashStyle, opacity, shadow },
      },
    });
  },

  copyFormatFromConnector: (id) => {
    const connector = get().connectors[id];
    if (!connector) return;
    const { lineStyle, startArrow, endArrow, pathStyle } = connector.style ?? {};
    set({ formatPainterClipboard: { kind: "connector", style: { lineStyle, startArrow, endArrow, pathStyle } } });
  },

  applyFormatPainterToShapes: (targetIds) => {
    const { formatPainterClipboard } = get();
    if (!formatPainterClipboard || formatPainterClipboard.kind !== "shape") return;
    const clipboardStyle = formatPainterClipboard.style;
    set((state) => {
      const updated = { ...state.shapes };
      for (const id of targetIds) {
        const existing = state.shapes[id];
        // "locked" (Z-05) sperrt laut eigener Dokumentation nur Position/
        // Größe/Rotation, nicht den visuellen Stil - der Formatpinsel darf
        // also auch auf gesperrte Shapes angewendet werden.
        if (!existing) continue;
        updated[id] = { ...existing, style: { ...existing.style, ...clipboardStyle } };
      }
      return { shapes: updated, formatPainterClipboard: null };
    });
  },

  applyFormatPainterToConnectors: (targetIds) => {
    const { formatPainterClipboard } = get();
    if (!formatPainterClipboard || formatPainterClipboard.kind !== "connector") return;
    const clipboardStyle = formatPainterClipboard.style;
    set((state) => {
      const updated = { ...state.connectors };
      for (const id of targetIds) {
        const existing = state.connectors[id];
        if (!existing) continue;
        updated[id] = { ...existing, style: { ...existing.style, ...clipboardStyle } };
      }
      return { connectors: updated, formatPainterClipboard: null };
    });
  },

  cancelFormatPainter: () => set({ formatPainterClipboard: null }),

  setShapeRotation: (id, rotation) =>
    set((state) => {
      const existing = state.shapes[id];
      if (!existing) return state;
      const normalized = ((rotation % 360) + 360) % 360;
      return {
        shapes: { ...state.shapes, [id]: { ...existing, style: { ...existing.style, rotation: normalized } } },
      };
    }),

  alignShapes: (ids, mode) => {
    const { shapes } = get();
    // Angeheftete Shapes (z.B. Boundary Events) haben keine frei setzbare
    // Position - sie folgen ihrem Host (siehe attachmentGeometry) und werden
    // deshalb von Ausrichten/Verteilen ausgenommen.
    const targets = ids
      .map((id) => shapes[id])
      .filter((s): s is ShapeInstance => Boolean(s) && !s.attachedToId);
    if (targets.length < 2) return;

    let reference: number;
    if (mode === "left") reference = Math.min(...targets.map((s) => s.position.x));
    else if (mode === "right") reference = Math.max(...targets.map((s) => s.position.x + s.size.width));
    else if (mode === "top") reference = Math.min(...targets.map((s) => s.position.y));
    else if (mode === "bottom") reference = Math.max(...targets.map((s) => s.position.y + s.size.height));
    else if (mode === "centerH") {
      const minX = Math.min(...targets.map((s) => s.position.x));
      const maxX = Math.max(...targets.map((s) => s.position.x + s.size.width));
      reference = (minX + maxX) / 2;
    } else {
      const minY = Math.min(...targets.map((s) => s.position.y));
      const maxY = Math.max(...targets.map((s) => s.position.y + s.size.height));
      reference = (minY + maxY) / 2;
    }

    set((state) => {
      let updated = { ...state.shapes };
      for (const s of targets) {
        let { x, y } = s.position;
        if (mode === "left") x = reference;
        else if (mode === "right") x = reference - s.size.width;
        else if (mode === "centerH") x = reference - s.size.width / 2;
        else if (mode === "top") y = reference;
        else if (mode === "bottom") y = reference - s.size.height;
        else if (mode === "middleV") y = reference - s.size.height / 2;
        updated[s.id] = { ...updated[s.id], position: { x, y } };
      }
      updated = repositionAttachedShapes(updated, new Set(targets.map((s) => s.id)));
      return { shapes: updated };
    });
  },

  distributeShapes: (ids, axis) => {
    const { shapes } = get();
    const targets = ids
      .map((id) => shapes[id])
      .filter((s): s is ShapeInstance => Boolean(s) && !s.attachedToId);
    if (targets.length < 3) return;

    const sorted = [...targets].sort((a, b) =>
      axis === "horizontal" ? a.position.x - b.position.x : a.position.y - b.position.y
    );
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const between = sorted.slice(1, -1);

    set((state) => {
      let updated = { ...state.shapes };
      if (axis === "horizontal") {
        const totalSpan = last.position.x - (first.position.x + first.size.width);
        const totalWidth = between.reduce((sum, s) => sum + s.size.width, 0);
        const gap = (totalSpan - totalWidth) / (sorted.length - 1);
        let cursor = first.position.x + first.size.width + gap;
        for (const s of between) {
          updated[s.id] = { ...updated[s.id], position: { ...updated[s.id].position, x: cursor } };
          cursor += s.size.width + gap;
        }
      } else {
        const totalSpan = last.position.y - (first.position.y + first.size.height);
        const totalHeight = between.reduce((sum, s) => sum + s.size.height, 0);
        const gap = (totalSpan - totalHeight) / (sorted.length - 1);
        let cursor = first.position.y + first.size.height + gap;
        for (const s of between) {
          updated[s.id] = { ...updated[s.id], position: { ...updated[s.id].position, y: cursor } };
          cursor += s.size.height + gap;
        }
      }
      updated = repositionAttachedShapes(updated, new Set(sorted.map((s) => s.id)));
      return { shapes: updated };
    });
  },

  setShapeParent: (id, parentId) => get().updateShape(id, { parentId }),

  getChildShapeIds: (parentId) =>
    Object.values(get().shapes)
      .filter((s) => s.parentId === parentId)
      .map((s) => s.id),

  groupShapes: (ids) => {
    if (ids.length < 2) return; // eine "Gruppe" aus einem einzigen Element ergibt keinen Sinn
    const groupId = `group_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    set((state) => {
      const updated = { ...state.shapes };
      for (const id of ids) {
        const shape = updated[id];
        if (!shape) continue;
        updated[id] = { ...shape, groupId };
      }
      return { shapes: updated };
    });
  },

  ungroupShapes: (ids) => {
    // Alle Mitglieder der betroffenen Gruppen ermitteln, nicht nur die
    // übergebenen IDs selbst - "Gruppierung aufheben" soll die ganze Gruppe
    // lösen, auch wenn z.B. nur ein Mitglied aktuell selektiert war.
    const { shapes } = get();
    const groupIds = new Set(ids.map((id) => shapes[id]?.groupId).filter((g): g is string => Boolean(g)));
    if (groupIds.size === 0) return;

    set((state) => {
      const updated = { ...state.shapes };
      for (const shape of Object.values(updated)) {
        if (shape.groupId && groupIds.has(shape.groupId)) {
          const { groupId: _drop, ...rest } = shape;
          updated[shape.id] = rest;
        }
      }
      return { shapes: updated };
    });
  },

  getGroupMemberIds: (id) => {
    const { shapes } = get();
    const shape = shapes[id];
    if (!shape?.groupId) return [id];
    return Object.values(shapes)
      .filter((s) => s.groupId === shape.groupId)
      .map((s) => s.id);
  },

  pasteShapesAndConnectors: (shapes, connectors) =>
    set((state) => {
      const newShapes = { ...state.shapes };
      shapes.forEach((s) => (newShapes[s.id] = s));
      const newConnectors = { ...state.connectors };
      connectors.forEach((c) => (newConnectors[c.id] = c));
      return {
        shapes: newShapes,
        connectors: newConnectors,
        selectedShapeIds: shapes.map((s) => s.id),
        selectedConnectorId: null,
      };
    }),

  addConnector: (connector) =>
    set((state) => ({ connectors: { ...state.connectors, [connector.id]: connector } })),

  removeConnector: (id) =>
    set((state) => {
      const connectors = { ...state.connectors };
      delete connectors[id];
      return {
        connectors,
        selectedConnectorId: state.selectedConnectorId === id ? null : state.selectedConnectorId,
      };
    }),

  updateConnectorWaypoints: (id, waypoints) =>
    set((state) => {
      const existing = state.connectors[id];
      if (!existing) return state;
      return { connectors: { ...state.connectors, [id]: { ...existing, waypoints } } };
    }),

  setConnectorLabel: (id, label) =>
    set((state) => {
      const existing = state.connectors[id];
      if (!existing) return state;
      return { connectors: { ...state.connectors, [id]: { ...existing, label } } };
    }),

  setConnectorLabelOffset: (id, offset) =>
    set((state) => {
      const existing = state.connectors[id];
      if (!existing) return state;
      return { connectors: { ...state.connectors, [id]: { ...existing, labelOffset: offset } } };
    }),

  startConnectorDraft: (sourceShapeId, sourcePortId, point) =>
    set({ connectorDraft: { sourceShapeId, sourcePortId, currentPoint: point } }),

  updateConnectorDraft: (point) =>
    set((state) =>
      state.connectorDraft
        ? { connectorDraft: { ...state.connectorDraft, currentPoint: point } }
        : state
    ),

  cancelConnectorDraft: () => set({ connectorDraft: null }),

  startReconnectDraft: (connectorId, end, point) =>
    set({ reconnectDraft: { connectorId, end, currentPoint: point } }),

  updateReconnectDraft: (point) =>
    set((state) =>
      state.reconnectDraft
        ? { reconnectDraft: { ...state.reconnectDraft, currentPoint: point } }
        : state
    ),

  cancelReconnectDraft: () => set({ reconnectDraft: null }),

  setConnectorEndpoint: (connectorId, end, shapeId, portId) =>
    set((state) => {
      const existing = state.connectors[connectorId];
      if (!existing) return state;
      const updated =
        end === "source"
          ? { ...existing, sourceShapeId: shapeId, sourcePortId: portId }
          : { ...existing, targetShapeId: shapeId, targetPortId: portId };
      return { connectors: { ...state.connectors, [connectorId]: updated } };
    }),

  setConnectorType: (connectorId, connectorType) =>
    set((state) => {
      const existing = state.connectors[connectorId];
      if (!existing) return state;
      return { connectors: { ...state.connectors, [connectorId]: { ...existing, connectorType } } };
    }),

  updateConnectorStyle: (connectorId, changes) =>
    set((state) => {
      const existing = state.connectors[connectorId];
      if (!existing) return state;
      return {
        connectors: { ...state.connectors, [connectorId]: { ...existing, style: { ...existing.style, ...changes } } },
      };
    }),

  insertManualWaypoint: (connectorId, index, point) =>
    set((state) => {
      const existing = state.connectors[connectorId];
      if (!existing) return state;
      const current = existing.manualWaypoints ?? [];
      const updated = [...current.slice(0, index), point, ...current.slice(index)];
      return { connectors: { ...state.connectors, [connectorId]: { ...existing, manualWaypoints: updated } } };
    }),

  moveManualWaypoint: (connectorId, index, point) =>
    set((state) => {
      const existing = state.connectors[connectorId];
      if (!existing?.manualWaypoints) return state;
      const updated = existing.manualWaypoints.map((wp, i) => (i === index ? point : wp));
      return { connectors: { ...state.connectors, [connectorId]: { ...existing, manualWaypoints: updated } } };
    }),

  removeManualWaypoint: (connectorId, index) =>
    set((state) => {
      const existing = state.connectors[connectorId];
      if (!existing?.manualWaypoints) return state;
      const updated = existing.manualWaypoints.filter((_, i) => i !== index);
      return {
        connectors: {
          ...state.connectors,
          [connectorId]: {
            ...existing,
            // Leeres Array explizit zu undefined machen, damit computeConnectorPath
            // sauber wieder aufs Auto-Routing zurückfällt (die Prüfung dort ist
            // "manualWaypoints && length > 0").
            manualWaypoints: updated.length > 0 ? updated : undefined,
          },
        },
      };
    }),

  selectShape: (id, additive = false) =>
    set((state) => {
      if (id === null) return { selectedShapeIds: [], selectedConnectorId: null };
      if (additive) {
        const isSelected = state.selectedShapeIds.includes(id);
        return {
          selectedShapeIds: isSelected
            ? state.selectedShapeIds.filter((s) => s !== id)
            : [...state.selectedShapeIds, id],
          selectedConnectorId: null,
        };
      }
      return { selectedShapeIds: [id], selectedConnectorId: null };
    }),

  selectShapes: (ids) => set({ selectedShapeIds: ids, selectedConnectorId: null }),

  selectConnector: (id) => set({ selectedConnectorId: id, selectedShapeIds: [] }),

  clearSelection: () => set({ selectedShapeIds: [], selectedConnectorId: null }),

  setHoveredShape: (id) => set({ hoveredShapeId: id }),

  startSelectionRect: (x, y) => set({ selectionRect: { startX: x, startY: y, currentX: x, currentY: y } }),

  updateSelectionRect: (x, y) =>
    set((state) =>
      state.selectionRect ? { selectionRect: { ...state.selectionRect, currentX: x, currentY: y } } : state
    ),

  endSelectionRect: () => set({ selectionRect: null }),

  addGuide: (axis, position) => {
    const id = `guide_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    set((state) => ({ guides: [...state.guides, { id, axis, position }] }));
    return id;
  },

  moveGuide: (id, position) =>
    set((state) => ({ guides: state.guides.map((g) => (g.id === id ? { ...g, position } : g)) })),

  removeGuide: (id) => set((state) => ({ guides: state.guides.filter((g) => g.id !== id) })),

  togglePagePreview: () => set((state) => ({ showPagePreview: !state.showPagePreview })),
}));
