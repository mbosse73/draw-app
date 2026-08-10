import type { ShapeInstance, ConnectorInstance, Point } from "../shapes/types";
import { getPortPosition, computeOrthogonalPath } from "./connectorGeometry";
import { findRoutedPath } from "./pathRouting";

/**
 * Berechnet den anzuzeigenden Pfad einer Verbindung nach klarer Priorität:
 * 1. Manuell gesetzte Wegpunkte (der Nutzer hat die Kontrolle übernommen)
 * 2. A*-Routing mit Kollisionsvermeidung (Standard)
 * 3. Einfacher orthogonaler Pfad als Fallback (z.B. bei Performance-Limits)
 *
 * `useRouting` erlaubt es, das A*-Routing für Performance-kritische Fälle
 * (z.B. während des Ziehens vieler Elemente gleichzeitig) zu überspringen.
 */
export function computeConnectorPath(
  connector: Pick<ConnectorInstance, "manualWaypoints">,
  from: Point,
  to: Point,
  shapes: Record<string, ShapeInstance>,
  excludeShapeIds: Set<string>,
  useRouting = true
): Point[] {
  if (connector.manualWaypoints && connector.manualWaypoints.length > 0) {
    return [from, ...connector.manualWaypoints, to];
  }
  if (useRouting) {
    return findRoutedPath(from, to, shapes, excludeShapeIds);
  }
  return computeOrthogonalPath(from, to);
}

/** Ermittelt Start-/Endpunkt einer Verbindung anhand der aktuellen Shape-Positionen. */
export function getConnectorEndpoints(
  connector: ConnectorInstance,
  shapes: Record<string, ShapeInstance>
): { from: Point; to: Point } | null {
  const sourceShape = shapes[connector.sourceShapeId];
  const targetShape = shapes[connector.targetShapeId];
  if (!sourceShape || !targetShape) return null;
  const from = getPortPosition(sourceShape, connector.sourcePortId);
  const to = getPortPosition(targetShape, connector.targetPortId);
  if (!from || !to) return null;
  return { from, to };
}
