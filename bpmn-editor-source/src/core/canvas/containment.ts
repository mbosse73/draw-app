import type { ShapeInstance } from "../shapes/types";
import { ShapeRegistry } from "../shapes/ShapeRegistry";

/**
 * Findet den am besten passenden Container (z.B. Lane), unter dem ein Punkt liegt.
 * Bei verschachtelten Containern (Pool > Lane) wird der kleinste/innerste zurückgegeben,
 * damit ein Element in eine Lane statt nur in den umgebenden Pool einsortiert wird.
 */
export function findContainerAt(
  shapes: Record<string, ShapeInstance>,
  point: { x: number; y: number },
  excludeId?: string
): string | undefined {
  let best: ShapeInstance | undefined;

  for (const shape of Object.values(shapes)) {
    if (shape.id === excludeId) continue;
    const definition = ShapeRegistry.get(shape.type);
    if (!definition?.isContainer) continue;

    // Auf-/zuklappbare Container (z.B. Sub-Prozess, erkennbar an gesetzten
    // collapsedSize/expandedSize) fungieren nur im ausgeklappten Zustand als
    // Container. Diese Prüfung bleibt generisch - die Core-Engine weiß nicht,
    // dass es sich um einen "Sub-Prozess" handelt, nur dass diese Shape-Art
    // einen Expand/Collapse-Zustand kennt.
    const isCollapsibleContainer = Boolean(definition.collapsedSize && definition.expandedSize);
    if (isCollapsibleContainer && !shape.data.expanded) continue;

    const withinX = point.x >= shape.position.x && point.x <= shape.position.x + shape.size.width;
    const withinY = point.y >= shape.position.y && point.y <= shape.position.y + shape.size.height;
    if (!withinX || !withinY) continue;

    // "Innerster" Container = der mit der kleinsten Fläche
    if (!best || shape.size.width * shape.size.height < best.size.width * best.size.height) {
      best = shape;
    }
  }

  return best?.id;
}

/** Prüft ob shapeId (direkt oder transitiv) ein Vorfahre von potentialChildId ist - verhindert Zyklen. */
export function isAncestor(
  shapes: Record<string, ShapeInstance>,
  shapeId: string,
  potentialChildId: string
): boolean {
  let current = shapes[potentialChildId];
  const visited = new Set<string>();
  while (current?.parentId) {
    if (current.parentId === shapeId) return true;
    if (visited.has(current.parentId)) break; // Sicherheitsnetz gegen kaputte Zyklen
    visited.add(current.parentId);
    current = shapes[current.parentId];
  }
  return false;
}
