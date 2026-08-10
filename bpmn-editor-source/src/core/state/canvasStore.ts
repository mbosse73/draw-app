import { create } from "zustand";
import type { ShapeInstance, ConnectorInstance, Point } from "../shapes/types";
import { getAttachedPosition } from "../canvas/attachmentGeometry";

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

  // Viewport-Aktionen
  setViewport: (viewport: Partial<Viewport>) => void;
  zoomAt: (screenX: number, screenY: number, delta: number) => void;
  pan: (dx: number, dy: number) => void;

  // Shape-Aktionen
  addShape: (shape: ShapeInstance) => void;
  updateShape: (id: string, changes: Partial<ShapeInstance>) => void;
  removeShape: (id: string) => void;
  moveShape: (id: string, position: { x: number; y: number }, skipGridSnap?: boolean) => void;
  /** Verschiebt mehrere Shapes gemeinsam um denselben Versatz (für Mehrfachauswahl). */
  moveShapesBy: (ids: string[], delta: { x: number; y: number }) => void;
  resizeShape: (id: string, size: { width: number; height: number }) => void;
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
  startConnectorDraft: (sourceShapeId: string, sourcePortId: string, point: Point) => void;
  updateConnectorDraft: (point: Point) => void;
  cancelConnectorDraft: () => void;
  startReconnectDraft: (connectorId: string, end: "source" | "target", point: Point) => void;
  updateReconnectDraft: (point: Point) => void;
  cancelReconnectDraft: () => void;
  setConnectorEndpoint: (connectorId: string, end: "source" | "target", shapeId: string, portId: string) => void;
  setConnectorType: (connectorId: string, connectorType: string) => void;
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
}

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4;

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

  setViewport: (viewport) =>
    set((state) => ({ viewport: { ...state.viewport, ...viewport } })),

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
}));
