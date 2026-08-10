import type { ShapeInstance, Point } from "../shapes/types";
import { ShapeRegistry } from "../shapes/ShapeRegistry";

/** Berechnet die absolute Weltposition eines Ports anhand seiner relativen Position in der Shape. */
export function getPortPosition(shape: ShapeInstance, portId: string): Point | null {
  const definition = ShapeRegistry.get(shape.type);
  if (!definition) return null;
  const port = definition.ports.find((p) => p.id === portId);
  if (!port) return null;

  return {
    x: shape.position.x + port.relativePosition.x * shape.size.width,
    y: shape.position.y + port.relativePosition.y * shape.size.height,
  };
}

/** Liefert alle Ports einer Shape mit ihren absoluten Weltpositionen. */
export function getAllPortPositions(shape: ShapeInstance): Array<{ portId: string; position: Point }> {
  const definition = ShapeRegistry.get(shape.type);
  if (!definition) return [];
  return definition.ports.map((port) => ({
    portId: port.id,
    position: {
      x: shape.position.x + port.relativePosition.x * shape.size.width,
      y: shape.position.y + port.relativePosition.y * shape.size.height,
    },
  }));
}

/**
 * Berechnet einen einfachen orthogonalen (rechtwinkligen) Verbindungspfad
 * zwischen zwei Punkten - typisch für Diagramm-Tools wie draw.io.
 * Für Meilenstein 2 bewusst einfach gehalten (kein Hindernis-Routing).
 */
export function computeOrthogonalPath(from: Point, to: Point): Point[] {
  const dx = Math.abs(to.x - from.x);
  const dy = Math.abs(to.y - from.y);

  // Bei fast gerader Linie: direkte Verbindung
  if (dx < 10 || dy < 10) {
    return [from, to];
  }

  // Mittelpunkt für einen einfachen L/Z-förmigen Pfad
  const midX = from.x + (to.x - from.x) / 2;
  return [from, { x: midX, y: from.y }, { x: midX, y: to.y }, to];
}

/** Findet die nächstgelegene Shape + Port unter einer Weltkoordinate (für Hover/Drop-Erkennung). */
export function findPortNear(
  shapes: Record<string, ShapeInstance>,
  worldPoint: Point,
  maxDistance: number
): { shapeId: string; portId: string } | null {
  let closest: { shapeId: string; portId: string; distance: number } | null = null;

  for (const shape of Object.values(shapes)) {
    const ports = getAllPortPositions(shape);
    for (const { portId, position } of ports) {
      const distance = Math.hypot(position.x - worldPoint.x, position.y - worldPoint.y);
      if (distance <= maxDistance && (!closest || distance < closest.distance)) {
        closest = { shapeId: shape.id, portId, distance };
      }
    }
  }

  return closest ? { shapeId: closest.shapeId, portId: closest.portId } : null;
}
