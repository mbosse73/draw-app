import { useCanvasStore } from "./canvasStore";
import type { ShapeInstance, ConnectorInstance } from "../shapes/types";

let clipboard: { shapes: ShapeInstance[]; connectors: ConnectorInstance[] } | null = null;

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function copySelectionToClipboard(): void {
  const state = useCanvasStore.getState();
  if (state.selectedShapeIds.length === 0) return;

  const idsToCopy = new Set<string>(state.selectedShapeIds);
  let frontier = [...state.selectedShapeIds];
  while (frontier.length > 0) {
    const next: string[] = [];
    for (const s of Object.values(state.shapes)) {
      const isChild = s.parentId && frontier.includes(s.parentId);
      const isAttached = s.attachedToId && frontier.includes(s.attachedToId);
      if ((isChild || isAttached) && !idsToCopy.has(s.id)) {
        idsToCopy.add(s.id);
        next.push(s.id);
      }
    }
    frontier = next;
  }

  const shapes = Array.from(idsToCopy)
    .map((id) => state.shapes[id])
    .filter((s): s is ShapeInstance => Boolean(s));

  const connectors = Object.values(state.connectors).filter(
    (c) => idsToCopy.has(c.sourceShapeId) && idsToCopy.has(c.targetShapeId)
  );

  clipboard = { shapes, connectors };
}

export function hasClipboardContent(): boolean {
  return clipboard !== null && clipboard.shapes.length > 0;
}

export function pasteClipboard(offset = { x: 30, y: 30 }): void {
  if (!clipboard || clipboard.shapes.length === 0) return;

  const idMap = new Map<string, string>();
  clipboard.shapes.forEach((s) => idMap.set(s.id, generateId("shape")));

  const newShapes: ShapeInstance[] = clipboard.shapes.map((s) => ({
    ...s,
    id: idMap.get(s.id)!,
    position: { x: s.position.x + offset.x, y: s.position.y + offset.y },
    parentId: s.parentId && idMap.has(s.parentId) ? idMap.get(s.parentId) : undefined,
    // attachedToId nur umbiegen, wenn der Host selbst mitkopiert wurde (analog
    // zu parentId oben). War der Host nicht Teil der Auswahl, würde die Kopie
    // sonst am ORIGINAL-Host hängen bleiben, statt sich frei/unabhängig zu
    // verhalten - das Attachment wird dann komplett aufgelöst.
    attachedToId: s.attachedToId && idMap.has(s.attachedToId) ? idMap.get(s.attachedToId) : undefined,
    attachmentRatio: s.attachedToId && idMap.has(s.attachedToId) ? s.attachmentRatio : undefined,
  }));

  const newConnectors: ConnectorInstance[] = clipboard.connectors.map((c) => ({
    ...c,
    id: generateId("conn"),
    sourceShapeId: idMap.get(c.sourceShapeId)!,
    targetShapeId: idMap.get(c.targetShapeId)!,
    waypoints: [],
  }));

  useCanvasStore.getState().pasteShapesAndConnectors(newShapes, newConnectors);
}
