import type { ShapeInstance, ConnectorInstance, ConnectorPathStyle, Point } from "../shapes/types";
import { getPortPosition, computeOrthogonalPath } from "./connectorGeometry";
import { findRoutedPath } from "./pathRouting";

/**
 * Berechnet den anzuzeigenden Pfad einer Verbindung nach klarer Priorität:
 * 1. Manuell gesetzte Wegpunkte (der Nutzer hat die Kontrolle übernommen)
 * 2. Gewählter Routingstil (Z-08): "straight" = direkte Linie, "stepped" =
 *    einzelner Knick (Entity-Relation-Stil), "orthogonal"/"curved" nutzen
 *    beide das A*-Routing als Wegpunkt-Basis - "curved" unterscheidet sich
 *    nur in der Darstellung (ConnectorLayer rendert dieselben Wegpunkte als
 *    sanfte Kurve statt scharfer Ecken, siehe dort `pathFromWaypointsSmooth`).
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
  useRouting = true,
  pathStyle: ConnectorPathStyle = "orthogonal"
): Point[] {
  if (connector.manualWaypoints && connector.manualWaypoints.length > 0) {
    return [from, ...connector.manualWaypoints, to];
  }
  if (pathStyle === "straight") {
    return [from, to];
  }
  if (pathStyle === "stepped") {
    return computeOrthogonalPath(from, to);
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
