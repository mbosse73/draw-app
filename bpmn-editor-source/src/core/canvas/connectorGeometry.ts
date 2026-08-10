import type { ShapeInstance, Point } from "../shapes/types";
import { ShapeRegistry } from "../shapes/ShapeRegistry";

/** Prefix für synthetische "freie" Portpositionen (Z-07): kein fest registrierter
 *  Port der ShapeDefinition, sondern eine beliebige relative Position am Rand
 *  einer Shape, direkt im portId codiert (z.B. "free:0.37,1"). Generisch in der
 *  Core-Engine gelöst, kein Modul muss dafür eigene Ports registrieren. */
const FREE_PORT_PREFIX = "free:";

export function freePortId(relativePosition: Point): string {
  return `${FREE_PORT_PREFIX}${relativePosition.x.toFixed(4)},${relativePosition.y.toFixed(4)}`;
}

function parseFreePortId(portId: string): Point | null {
  if (!portId.startsWith(FREE_PORT_PREFIX)) return null;
  const [xStr, yStr] = portId.slice(FREE_PORT_PREFIX.length).split(",");
  const x = Number(xStr);
  const y = Number(yStr);
  if (Number.isNaN(x) || Number.isNaN(y)) return null;
  return { x, y };
}

/** Berechnet die absolute Weltposition eines Ports anhand seiner relativen Position in der Shape. */
export function getPortPosition(shape: ShapeInstance, portId: string): Point | null {
  const free = parseFreePortId(portId);
  if (free) {
    return {
      x: shape.position.x + free.x * shape.size.width,
      y: shape.position.y + free.y * shape.size.height,
    };
  }

  const definition = ShapeRegistry.get(shape.type);
  if (!definition) return null;
  const port = definition.ports.find((p) => p.id === portId);
  if (!port) return null;

  return {
    x: shape.position.x + port.relativePosition.x * shape.size.width,
    y: shape.position.y + port.relativePosition.y * shape.size.height,
  };
}

/** Projiziert einen Weltpunkt auf den nächstgelegenen Punkt am Rand einer
 *  Shape und gibt dessen relative Position (0..1) zurück - Grundlage für
 *  freie Verbindungspunkte (Z-07): der Nutzer kann eine Verbindung an einer
 *  beliebigen Stelle am Rand andocken, nicht nur an den 4 festen Ports. */
export function projectPointOntoShapeBorder(shape: ShapeInstance, point: Point): { relativePosition: Point; distance: number } {
  const { x, y } = shape.position;
  const { width, height } = shape.size;
  const clampedX = Math.min(Math.max(point.x, x), x + width);
  const clampedY = Math.min(Math.max(point.y, y), y + height);

  // Abstand zu jeder der 4 Kanten (der Punkt wird zuerst in die Box geklemmt,
  // dann die naheliegendste Kante bestimmt) - funktioniert auch für Punkte
  // innerhalb der Shape (z.B. beim Reconnect-Ziehen über die Shape-Mitte).
  const distToLeft = Math.abs(clampedX - x);
  const distToRight = Math.abs(x + width - clampedX);
  const distToTop = Math.abs(clampedY - y);
  const distToBottom = Math.abs(y + height - clampedY);
  const minDist = Math.min(distToLeft, distToRight, distToTop, distToBottom);

  let borderX = clampedX;
  let borderY = clampedY;
  if (minDist === distToLeft) borderX = x;
  else if (minDist === distToRight) borderX = x + width;
  else if (minDist === distToTop) borderY = y;
  else borderY = y + height;

  const distance = Math.hypot(point.x - borderX, point.y - borderY);
  return {
    relativePosition: {
      x: width === 0 ? 0.5 : (borderX - x) / width,
      y: height === 0 ? 0.5 : (borderY - y) / height,
    },
    distance,
  };
}

/** Findet die Shape, deren Rand am nächsten an `point` liegt (innerhalb
 *  `maxDistance`), und liefert eine synthetische freie Port-Id dafür (Z-07).
 *  Wird als Fallback genutzt, wenn `findPortNear` keinen festen Port trifft. */
export function findFreePortOnShapeBorder(
  shapes: Record<string, ShapeInstance>,
  point: Point,
  maxDistance: number
): { shapeId: string; portId: string } | null {
  let closest: { shapeId: string; portId: string; distance: number } | null = null;
  for (const shape of Object.values(shapes)) {
    const definition = ShapeRegistry.get(shape.type);
    if (!definition || definition.isContainer) continue; // Container haben keine Ports (siehe PoolLaneShapes.tsx)
    const { relativePosition, distance } = projectPointOntoShapeBorder(shape, point);
    if (distance <= maxDistance && (!closest || distance < closest.distance)) {
      closest = { shapeId: shape.id, portId: freePortId(relativePosition), distance };
    }
  }
  return closest ? { shapeId: closest.shapeId, portId: closest.portId } : null;
}

/**
 * Letzte Stufe der Ziel-Auflösung beim Loslassen einer Verbindung (F-11):
 * Wird die Maus MITTEN auf einer Shape losgelassen - also weder nahe genug an
 * einem festen Port noch nahe genug an deren Rand -, ist die gemeinte Absicht
 * trotzdem eindeutig "verbinde mit dieser Shape". Vorher scheiterte der
 * Verbindungsversuch dort stillschweigend (bei einem Hover-Pfeil entstand
 * sogar eine neue Shape genau über der bereits vorhandenen).
 *
 * Angedockt wird am festen Port, der dem Ausgangspunkt am nächsten liegt -
 * so betritt die Verbindung die Shape von der Seite, aus der sie kommt,
 * statt an einer willkürlichen Kante zu landen.
 */
export function findPortOnShapeAtPoint(
  shapes: Record<string, ShapeInstance>,
  point: Point,
  fromPoint: Point
): { shapeId: string; portId: string } | null {
  let treffer: { shape: ShapeInstance; flaeche: number } | null = null;
  for (const shape of Object.values(shapes)) {
    if (shape.hidden || shape.locked) continue;
    const definition = ShapeRegistry.get(shape.type);
    // Container (Pools/Lanes) bewusst übersprungen: sie liegen unter ihren
    // Kindern, ein Loslassen "auf" ihnen meint fast immer das Kind-Element.
    if (!definition || definition.isContainer) continue;
    const { x, y } = shape.position;
    const { width, height } = shape.size;
    if (point.x < x || point.x > x + width || point.y < y || point.y > y + height) continue;
    const flaeche = width * height;
    // Bei Überlappung gewinnt die kleinere Shape - das ist die, die der
    // Nutzer sieht (größere liegen als Hintergrund darunter).
    if (!treffer || flaeche < treffer.flaeche) treffer = { shape, flaeche };
  }
  if (!treffer) return null;

  const ports = getAllPortPositions(treffer.shape);
  if (ports.length === 0) {
    const { relativePosition } = projectPointOntoShapeBorder(treffer.shape, fromPoint);
    return { shapeId: treffer.shape.id, portId: freePortId(relativePosition) };
  }
  let bester = ports[0];
  let besteDistanz = Infinity;
  for (const p of ports) {
    const d = Math.hypot(p.position.x - fromPoint.x, p.position.y - fromPoint.y);
    if (d < besteDistanz) {
      besteDistanz = d;
      bester = p;
    }
  }
  return { shapeId: treffer.shape.id, portId: bester.portId };
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
