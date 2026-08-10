import type { ShapeInstance, ConnectorInstance } from "../shapes/types";
import type { ConnectorDraft, ReconnectDraft } from "../state/canvasStore";
import { getConnectorEndpoints, computeConnectorPath } from "./connectorPath";
import { getPortPosition } from "./connectorGeometry";
import { MultilineText } from "./MultilineText";
import { ConnectorTypeRegistry, DEFAULT_CONNECTOR_STYLE } from "../shapes/ConnectorTypeRegistry";

interface ConnectorLayerProps {
  shapes: Record<string, ShapeInstance>;
  connectors: Record<string, ConnectorInstance>;
  connectorDraft: ConnectorDraft | null;
  reconnectDraft: ReconnectDraft | null;
  selectedConnectorId: string | null;
  onSelectConnector: (id: string) => void;
  onDoubleClickConnector: (id: string) => void;
  onEndpointMouseDown: (connectorId: string, end: "source" | "target", e: React.MouseEvent) => void;
  onAddWaypoint: (connectorId: string, index: number, point: { x: number; y: number }) => void;
  onWaypointMouseDown: (connectorId: string, waypointIndex: number, e: React.MouseEvent) => void;
  onWaypointDoubleClick: (connectorId: string, waypointIndex: number) => void;
  /** Während lastig vieler gleichzeitiger Bewegungen (z.B. Gruppen-Drag) kann
   *  das teure A*-Routing übersprungen werden, um flüssig zu bleiben. */
  useRouting: boolean;
}

function pathFromWaypoints(waypoints: { x: number; y: number }[]): string {
  if (waypoints.length === 0) return "";
  return waypoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
}

function dashArrayFor(lineStyle: string): string | undefined {
  if (lineStyle === "dashed") return "8 5";
  if (lineStyle === "dotted") return "2 4";
  return undefined;
}

export function ConnectorLayer({
  shapes,
  connectors,
  connectorDraft,
  reconnectDraft,
  selectedConnectorId,
  onSelectConnector,
  onDoubleClickConnector,
  onEndpointMouseDown,
  onAddWaypoint,
  onWaypointMouseDown,
  onWaypointDoubleClick,
  useRouting,
}: ConnectorLayerProps) {
  return (
    <g className="connector-layer">
      <defs>
        <marker id="arrow-head" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--connector-color, #555555)" />
        </marker>
        <marker id="arrow-head-selected" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--accent, #3d5a99)" />
        </marker>
      </defs>

      {Object.values(connectors).map((connector) => {
        const endpoints = getConnectorEndpoints(connector, shapes);
        if (!endpoints) return null;
        let { from, to } = endpoints;

        const isReconnecting = reconnectDraft?.connectorId === connector.id;
        if (isReconnecting && reconnectDraft) {
          if (reconnectDraft.end === "source") from = reconnectDraft.currentPoint;
          else to = reconnectDraft.currentPoint;
        }

        const excludeIds = new Set([connector.sourceShapeId, connector.targetShapeId]);
        const waypoints = computeConnectorPath(connector, from, to, shapes, excludeIds, useRouting);
        const isSelected = selectedConnectorId === connector.id;

        const style = ConnectorTypeRegistry.get(connector.connectorType) ?? DEFAULT_CONNECTOR_STYLE;
        const hasManualWaypoints = Boolean(connector.manualWaypoints && connector.manualWaypoints.length > 0);

        return (
          <g key={connector.id}>
            <g onMouseDown={(e) => { e.stopPropagation(); onSelectConnector(connector.id); }} onDoubleClick={(e) => { e.stopPropagation(); onDoubleClickConnector(connector.id); }}>
              <path d={pathFromWaypoints(waypoints)} fill="none" stroke="transparent" strokeWidth={14} style={{ cursor: "pointer" }} />
              <path
                d={pathFromWaypoints(waypoints)}
                fill="none"
                stroke={isSelected ? "var(--accent, #3d5a99)" : "var(--connector-color, #555555)"}
                strokeWidth={isSelected ? 2.5 : 1.75}
                strokeDasharray={isReconnecting ? "6 4" : dashArrayFor(style.lineStyle)}
                markerEnd={style.showArrow ? (isSelected ? "url(#arrow-head-selected)" : "url(#arrow-head)") : undefined}
              />
              {connector.label && !isReconnecting && (
                <MultilineText
                  text={connector.label}
                  x={(from.x + to.x) / 2}
                  y={(from.y + to.y) / 2 - 6}
                  fontSize={12}
                  fill="#555"
                />
              )}
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
                      key={i}
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
                    vertraute Interaktion aus draw.io/Illustrator/Figma). */}
                {!hasManualWaypoints &&
                  waypoints.slice(0, -1).map((p, i) => {
                    const next = waypoints[i + 1];
                    const midX = (p.x + next.x) / 2;
                    const midY = (p.y + next.y) / 2;
                    return (
                      <circle
                        key={i}
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
                          onAddWaypoint(connector.id, 0, { x: midX, y: midY });
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
