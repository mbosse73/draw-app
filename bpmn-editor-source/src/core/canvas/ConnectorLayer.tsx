import type { ShapeInstance, ConnectorInstance, ConnectorPathStyle, Point } from "../shapes/types";
import type { ConnectorDraft, ReconnectDraft } from "../state/canvasStore";
import { getConnectorEndpoints, computeConnectorPath } from "./connectorPath";
import { getPortPosition } from "./connectorGeometry";
import { MultilineText } from "./MultilineText";
import { ConnectorTypeRegistry, DEFAULT_CONNECTOR_STYLE } from "../shapes/ConnectorTypeRegistry";
import {
  arrowMarkerDescriptors,
  arrowMarkerElementId,
  dashArrayFor,
  resolveConnectorArrowStyle,
  resolveConnectorLineStyle,
} from "./connectorStyle";

interface ConnectorLayerProps {
  shapes: Record<string, ShapeInstance>;
  connectors: Record<string, ConnectorInstance>;
  connectorDraft: ConnectorDraft | null;
  reconnectDraft: ReconnectDraft | null;
  selectedConnectorId: string | null;
  onSelectConnector: (id: string) => void;
  onDoubleClickConnector: (id: string) => void;
  onContextMenuConnector: (connectorId: string, e: React.MouseEvent) => void;
  onEndpointMouseDown: (connectorId: string, end: "source" | "target", e: React.MouseEvent) => void;
  onAddWaypoint: (connectorId: string, index: number, point: { x: number; y: number }) => void;
  /** Fügt sofort (ohne Drag) einen Wegpunkt ein - Doppelklick auf ein
   *  Verbinder-Segment (Z-10). */
  onQuickInsertWaypoint: (connectorId: string, index: number, point: { x: number; y: number }) => void;
  onWaypointMouseDown: (connectorId: string, waypointIndex: number, e: React.MouseEvent) => void;
  onWaypointDoubleClick: (connectorId: string, waypointIndex: number) => void;
  /** Startet das freie Verschieben des Verbinder-Labels (siehe labelOffset). */
  onLabelMouseDown: (connectorId: string, e: React.MouseEvent) => void;
  /** Während lastig vieler gleichzeitiger Bewegungen (z.B. Gruppen-Drag) kann
   *  das teure A*-Routing übersprungen werden, um flüssig zu bleiben. */
  useRouting: boolean;
}

function pathFromWaypoints(waypoints: Point[]): string {
  if (waypoints.length === 0) return "";
  return waypoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
}

/**
 * Rendert dieselben Wegpunkte als sanfte Kurve statt scharfer Ecken (Z-08,
 * "kurvig-bezier"). Klassischer "smooth polyline"-Trick: quadratische
 * Bezier-Kurven zu den jeweiligen Segment-Mittelpunkten, mit dem Wegpunkt
 * selbst als Kontrollpunkt - die Kurve nähert sich den Ecken an statt exakt
 * durch sie zu zwingen. `T` (smooth quadratic) spiegelt automatisch den
 * vorherigen Kontrollpunkt, damit die Kurve am Ende exakt im Zielpunkt endet.
 */
function pathFromWaypointsSmooth(waypoints: Point[]): string {
  if (waypoints.length <= 2) return pathFromWaypoints(waypoints);
  let d = `M ${waypoints[0].x} ${waypoints[0].y}`;
  for (let i = 1; i < waypoints.length - 1; i++) {
    const curr = waypoints[i];
    const next = waypoints[i + 1];
    const midX = (curr.x + next.x) / 2;
    const midY = (curr.y + next.y) / 2;
    d += ` Q ${curr.x} ${curr.y} ${midX} ${midY}`;
  }
  const last = waypoints[waypoints.length - 1];
  d += ` T ${last.x} ${last.y}`;
  return d;
}

interface JumpMark {
  segmentIndex: number;
  point: Point;
}

const JUMP_RADIUS = 6;

/**
 * Baut den "d"-String einer Verbindung, unterbrochen von kleinen Halbkreis-
 * Ausbuchtungen ("Line Jumps", Z-09) an den übergebenen Kreuzungspunkten -
 * damit an echten Kreuzungen zweier unabhängiger Linien keine Verbindung
 * suggeriert wird. Mehrere Kreuzungen auf demselben Segment werden entlang
 * des Segments sortiert korrekt nacheinander eingefügt.
 */
function pathFromWaypointsWithJumps(waypoints: Point[], jumps: JumpMark[] | undefined): string {
  if (!jumps || jumps.length === 0) return pathFromWaypoints(waypoints);
  const bySegment = new Map<number, Point[]>();
  for (const j of jumps) {
    const list = bySegment.get(j.segmentIndex);
    if (list) list.push(j.point);
    else bySegment.set(j.segmentIndex, [j.point]);
  }

  let d = `M ${waypoints[0].x} ${waypoints[0].y}`;
  for (let i = 0; i < waypoints.length - 1; i++) {
    const p1 = waypoints[i];
    const p2 = waypoints[i + 1];
    const segPoints = bySegment.get(i);
    const segLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    if (!segPoints || segPoints.length === 0 || segLen < JUMP_RADIUS * 2.5) {
      d += ` L ${p2.x} ${p2.y}`;
      continue;
    }
    const dirX = (p2.x - p1.x) / segLen;
    const dirY = (p2.y - p1.y) / segLen;
    const sorted = segPoints
      .map((pt) => ({ t: (pt.x - p1.x) * dirX + (pt.y - p1.y) * dirY }))
      .filter(({ t }) => t > JUMP_RADIUS && t < segLen - JUMP_RADIUS)
      .sort((a, b) => a.t - b.t);
    for (const { t } of sorted) {
      const bx = p1.x + dirX * (t - JUMP_RADIUS);
      const by = p1.y + dirY * (t - JUMP_RADIUS);
      const ax = p1.x + dirX * (t + JUMP_RADIUS);
      const ay = p1.y + dirY * (t + JUMP_RADIUS);
      d += ` L ${bx} ${by} A ${JUMP_RADIUS} ${JUMP_RADIUS} 0 0 1 ${ax} ${ay}`;
    }
    d += ` L ${p2.x} ${p2.y}`;
  }
  return d;
}

/** Allgemeine Schnittpunkt-Berechnung zweier Liniensegmente. Gibt nur echte,
 *  INNERE Kreuzungen zurück (nicht nahe an einem der beiden Segmentenden) -
 *  damit gemeinsame Ecken/Knicke nicht fälschlich als "Kreuzung" gelten. */
function segmentIntersection(p1: Point, p2: Point, p3: Point, p4: Point): Point | null {
  const d1x = p2.x - p1.x;
  const d1y = p2.y - p1.y;
  const d2x = p4.x - p3.x;
  const d2y = p4.y - p3.y;
  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < 1e-9) return null; // parallel oder kollinear

  const t = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / denom;
  const u = ((p3.x - p1.x) * d1y - (p3.y - p1.y) * d1x) / denom;
  const EPS = 0.02;
  if (t <= EPS || t >= 1 - EPS || u <= EPS || u >= 1 - EPS) return null;
  return { x: p1.x + t * d1x, y: p1.y + t * d1y };
}

const MARKER_VARIANTS = [
  { id: "normal", color: "var(--connector-color, #555555)" },
  { id: "selected", color: "var(--accent, #3d5a99)" },
];

export function ConnectorLayer({
  shapes,
  connectors,
  connectorDraft,
  reconnectDraft,
  selectedConnectorId,
  onSelectConnector,
  onDoubleClickConnector,
  onContextMenuConnector,
  onEndpointMouseDown,
  onAddWaypoint,
  onQuickInsertWaypoint,
  onWaypointMouseDown,
  onWaypointDoubleClick,
  onLabelMouseDown,
  useRouting,
}: ConnectorLayerProps) {
  const markers = arrowMarkerDescriptors(MARKER_VARIANTS);

  // Erste Passe: Endpunkte + Wegpunkte + Pfadstil je Verbindung berechnen -
  // wird für die Line-Jump-Erkennung (Z-09) über ALLE Verbindungspaare hinweg
  // gebraucht, bevor irgendetwas gerendert wird.
  const connectorList = Object.values(connectors);
  const computed = new Map<
    string,
    { from: Point; to: Point; waypoints: Point[]; pathStyle: ConnectorPathStyle; isReconnecting: boolean }
  >();
  for (const connector of connectorList) {
    const endpoints = getConnectorEndpoints(connector, shapes);
    if (!endpoints) continue;
    let { from, to } = endpoints;
    const isReconnecting = reconnectDraft?.connectorId === connector.id;
    if (isReconnecting && reconnectDraft) {
      if (reconnectDraft.end === "source") from = reconnectDraft.currentPoint;
      else to = reconnectDraft.currentPoint;
    }
    const pathStyle = connector.style?.pathStyle ?? "orthogonal";
    const excludeIds = new Set([connector.sourceShapeId, connector.targetShapeId]);
    const waypoints = computeConnectorPath(connector, from, to, shapes, excludeIds, useRouting, pathStyle);
    computed.set(connector.id, { from, to, waypoints, pathStyle, isReconnecting });
  }

  // Zweite Passe: Kreuzungen zwischen unabhängigen Verbindungen finden
  // (Z-09). Von jedem kreuzenden Paar bekommt die SPÄTERE (höherer Index in
  // `ids`) den Sprung - eine einfache, deterministische Konvention. Kurvige
  // Verbindungen werden von der Sprung-Berechnung ausgenommen (Kreuzungen
  // auf Bezier-Kurven sind kein einfaches Segment-Problem mehr).
  const jumpsByConnector = new Map<string, JumpMark[]>();
  const ids = Array.from(computed.keys());
  for (let i = 0; i < ids.length; i++) {
    const a = computed.get(ids[i])!;
    if (a.pathStyle === "curved") continue;
    for (let j = i + 1; j < ids.length; j++) {
      const b = computed.get(ids[j])!;
      if (b.pathStyle === "curved") continue;
      for (let ai = 0; ai < a.waypoints.length - 1; ai++) {
        for (let bi = 0; bi < b.waypoints.length - 1; bi++) {
          const pt = segmentIntersection(a.waypoints[ai], a.waypoints[ai + 1], b.waypoints[bi], b.waypoints[bi + 1]);
          if (!pt) continue;
          const list = jumpsByConnector.get(ids[j]);
          const mark = { segmentIndex: bi, point: pt };
          if (list) list.push(mark);
          else jumpsByConnector.set(ids[j], [mark]);
        }
      }
    }
  }

  return (
    <g className="connector-layer">
      <defs>
        {markers.map((m) => (
          <marker
            key={m.elementId}
            id={m.elementId}
            viewBox={m.viewBox}
            refX={m.refX}
            refY={m.refY}
            markerWidth={8}
            markerHeight={8}
            orient="auto-start-reverse"
          >
            {m.element === "path" ? (
              <path d={m.d} fill={m.color} />
            ) : (
              <circle cx={m.cx} cy={m.cy} r={m.r} fill={m.color} />
            )}
          </marker>
        ))}
      </defs>

      {connectorList.map((connector) => {
        const entry = computed.get(connector.id);
        if (!entry) return null;
        const { from, to, waypoints, pathStyle, isReconnecting } = entry;
        const isSelected = selectedConnectorId === connector.id;

        const typeStyle = ConnectorTypeRegistry.get(connector.connectorType) ?? DEFAULT_CONNECTOR_STYLE;
        const lineStyle = resolveConnectorLineStyle(connector, typeStyle);
        const arrows = resolveConnectorArrowStyle(connector, typeStyle);
        const markerVariant = isSelected ? "selected" : "normal";
        const hasManualWaypoints = Boolean(connector.manualWaypoints && connector.manualWaypoints.length > 0);

        const jumps = jumpsByConnector.get(connector.id);
        const rawD = pathStyle === "curved" ? pathFromWaypointsSmooth(waypoints) : pathFromWaypoints(waypoints);
        const d = pathStyle === "curved" ? rawD : pathFromWaypointsWithJumps(waypoints, jumps);

        return (
          // onContextMenu sitzt bewusst am äußersten <g> (nicht nur am
          // inneren Pfad-Wrapper): sobald die Verbindung selektiert ist,
          // erscheinen Endpunkt-/Wegpunkt-Griffe als GESCHWISTER dieses
          // inneren Wrappers. Ein Rechtsklick auf einen dieser Griffe (die
          // selbst kein onContextMenu haben) würde sonst ungefangen bis zum
          // Canvas durchbubbeln und das falsche (Leerflächen-)Menü zeigen.
          <g key={connector.id} onContextMenu={(e) => { e.stopPropagation(); onContextMenuConnector(connector.id, e); }}>
            <g
              onMouseDown={(e) => { e.stopPropagation(); onSelectConnector(connector.id); }}
              onDoubleClick={(e) => { e.stopPropagation(); onDoubleClickConnector(connector.id); }}
            >
              <path d={d} fill="none" stroke="transparent" strokeWidth={14} style={{ cursor: "pointer" }} />
              <path
                d={d}
                fill="none"
                stroke={isSelected ? "var(--accent, #3d5a99)" : "var(--connector-color, #555555)"}
                strokeWidth={isSelected ? 2.5 : 1.75}
                strokeDasharray={isReconnecting ? "6 4" : dashArrayFor(lineStyle)}
                markerStart={
                  isReconnecting
                    ? undefined
                    : (() => {
                        const id = arrowMarkerElementId(arrows.start, markerVariant);
                        return id ? `url(#${id})` : undefined;
                      })()
                }
                markerEnd={
                  isReconnecting
                    ? undefined
                    : (() => {
                        const id = arrowMarkerElementId(arrows.end, markerVariant);
                        return id ? `url(#${id})` : undefined;
                      })()
                }
              />
              {connector.label && !isReconnecting && (() => {
                const offset = connector.labelOffset ?? { x: 0, y: -6 };
                const labelX = (from.x + to.x) / 2 + offset.x;
                const labelY = (from.y + to.y) / 2 + offset.y;
                const lines = connector.label.split("\n");
                const longestLine = Math.max(...lines.map((l) => l.length), 1);
                // Grobe Schätzung der Textausdehnung (kein DOM-Messen verfügbar) -
                // großzügig genug für eine gut greifbare, aber nicht die ganze
                // Verbindung überdeckende Zieh-Trefferfläche.
                const hitWidth = Math.max(30, longestLine * 6.8 + 10);
                const hitHeight = Math.max(16, lines.length * 15 + 4);
                return (
                  <g>
                    <rect
                      x={labelX - hitWidth / 2}
                      y={labelY - hitHeight / 2}
                      width={hitWidth}
                      height={hitHeight}
                      fill="transparent"
                      style={{ cursor: "move" }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        onSelectConnector(connector.id);
                        onLabelMouseDown(connector.id, e);
                      }}
                    />
                    <MultilineText text={connector.label} x={labelX} y={labelY} fontSize={12} fill="#555" />
                  </g>
                );
              })()}
            </g>

            {isSelected && !isReconnecting && (
              <>
                {/* Endpunkt-Griffe zum Lösen & Neuandocken */}
                <circle
                  cx={from.x} cy={from.y} r={6} fill="#ffffff" stroke="var(--accent, #3d5a99)" strokeWidth={2}
                  style={{ cursor: "crosshair" }}
                  onMouseDown={(e) => { e.stopPropagation(); onEndpointMouseDown(connector.id, "source", e); }}
                />
                <circle
                  cx={to.x} cy={to.y} r={6} fill="#ffffff" stroke="var(--accent, #3d5a99)" strokeWidth={2}
                  style={{ cursor: "crosshair" }}
                  onMouseDown={(e) => { e.stopPropagation(); onEndpointMouseDown(connector.id, "target", e); }}
                />

                {/* Wegpunkt-Griffe: bestehende manuelle Wegpunkte verschiebbar,
                    per Doppelklick entfernbar (kehrt dann zu Auto-Routing zurück
                    sobald keine mehr übrig sind). */}
                {hasManualWaypoints &&
                  connector.manualWaypoints!.map((wp, i) => (
                    <rect
                      key={`wp-${i}`}
                      x={wp.x - 5}
                      y={wp.y - 5}
                      width={10}
                      height={10}
                      fill="#fff8e6"
                      stroke="#c9962c"
                      strokeWidth={1.5}
                      style={{ cursor: "move" }}
                      onMouseDown={(e) => { e.stopPropagation(); onWaypointMouseDown(connector.id, i, e); }}
                      onDoubleClick={(e) => { e.stopPropagation(); onWaypointDoubleClick(connector.id, i); }}
                    />
                  ))}

                {/* Unsichtbare Griffe auf den Segment-Mitten, um einen neuen
                    Wegpunkt hinzuzufügen (Ziehen an einer beliebigen Stelle
                    der Linie "reißt" dort einen neuen Kontrollpunkt auf -
                    vertraute Interaktion aus draw.io/Illustrator/Figma).
                    Ein DOPPELKLICK fügt stattdessen sofort (ohne Ziehen) einen
                    Wegpunkt am Segment-Mittelpunkt ein (Z-10). Bewusst IMMER
                    gerendert (nicht nur ohne bestehende manuelle Wegpunkte) -
                    sonst ließe sich pro Verbinder nur ein einziger Knick je
                    setzen, weil diese Griffe nach dem ersten manuellen
                    Wegpunkt sonst verschwänden. `i` entspricht dabei direkt dem
                    Ziel-Index in `manualWaypoints` (waypoints[0] ist `from`,
                    also liegt Segment i zwischen manualWaypoints[i-1] und
                    manualWaypoints[i] - exakt die von insertManualWaypoint
                    erwartete Einfügeposition). */}
                {waypoints.slice(0, -1).map((p, i) => {
                    const next = waypoints[i + 1];
                    const midX = (p.x + next.x) / 2;
                    const midY = (p.y + next.y) / 2;
                    return (
                      <circle
                        key={`add-${i}`}
                        cx={midX}
                        cy={midY}
                        r={5}
                        fill="rgba(74,144,217,0.15)"
                        stroke="var(--accent, #3d5a99)"
                        strokeWidth={1}
                        strokeDasharray="2 2"
                        style={{ cursor: "crosshair" }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          onAddWaypoint(connector.id, i, { x: midX, y: midY });
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          onQuickInsertWaypoint(connector.id, i, { x: midX, y: midY });
                        }}
                      />
                    );
                  })}
              </>
            )}
          </g>
        );
      })}

      {connectorDraft && (() => {
        const sourceShape = shapes[connectorDraft.sourceShapeId];
        if (!sourceShape) return null;
        const from = getPortPosition(sourceShape, connectorDraft.sourcePortId);
        if (!from) return null;
        return (
          <path
            d={`M ${from.x} ${from.y} L ${connectorDraft.currentPoint.x} ${connectorDraft.currentPoint.y}`}
            fill="none"
            stroke="var(--accent, #3d5a99)"
            strokeWidth={2}
            strokeDasharray="6 4"
            style={{ pointerEvents: "none" }}
          />
        );
      })()}
    </g>
  );
}
