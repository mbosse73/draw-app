import type { ShapeDefinition, ShapeRenderProps } from "../../../core/shapes/types";
import { ShapeRegistry } from "../../../core/shapes/ShapeRegistry";
import { MultilineText } from "../../../core/canvas/MultilineText";
import { GATEWAY_SIZE, BPMN_COLORS, resolveFill, resolveStroke, resolveStrokeWidth, resolveDashArray } from "./constants";

type GatewayKind = "exclusive" | "parallel" | "inclusive" | "none";

// Ports an den 4 Diamant-Spitzen (nicht an den Kanten wie bei Rechtecken)
const GATEWAY_PORTS = [
  { id: "top", relativePosition: { x: 0.5, y: 0 } },
  { id: "right", relativePosition: { x: 1, y: 0.5 } },
  { id: "bottom", relativePosition: { x: 0.5, y: 1 } },
  { id: "left", relativePosition: { x: 0, y: 0.5 } },
];

function GatewaySymbol({ kind, size }: { kind: GatewayKind; size: number }) {
  const c = size / 2;
  const r = size * 0.22;
  const stroke = BPMN_COLORS.icon;

  if (kind === "exclusive") {
    // X-Symbol
    const d = r * 0.7;
    return (
      <g stroke={stroke} strokeWidth={2.2}>
        <line x1={c - d} y1={c - d} x2={c + d} y2={c + d} />
        <line x1={c + d} y1={c - d} x2={c - d} y2={c + d} />
      </g>
    );
  }
  if (kind === "parallel") {
    // Plus-Symbol
    return (
      <g stroke={stroke} strokeWidth={2.2}>
        <line x1={c - r} y1={c} x2={c + r} y2={c} />
        <line x1={c} y1={c - r} x2={c} y2={c + r} />
      </g>
    );
  }
  if (kind === "none") {
    return null; // einfaches Gateway ohne Symbol in der Mitte
  }
  // inclusive: Kreis
  return <circle cx={c} cy={c} r={r} fill="none" stroke={stroke} strokeWidth={2.2} />;
}

function GatewayRender({ shape, isSelected }: ShapeRenderProps) {
  const kind = (shape.data.gatewayType as GatewayKind) ?? "exclusive";
  const stroke = isSelected ? BPMN_COLORS.strokeSelected : resolveStroke(shape, BPMN_COLORS.stroke);
  const { width: w, height: h } = shape.size;

  // Raute als Polygon: oben, rechts, unten, links
  const points = `${w / 2},0 ${w},${h / 2} ${w / 2},${h} 0,${h / 2}`;

  return (
    <g transform={`translate(${shape.position.x} ${shape.position.y})`}>
      <polygon
        points={points}
        fill={resolveFill(shape, BPMN_COLORS.fill)}
        stroke={stroke}
        strokeWidth={isSelected ? 2 : resolveStrokeWidth(shape, 1.5)}
        strokeDasharray={resolveDashArray(shape)}
      />
      <GatewaySymbol kind={kind} size={Math.min(w, h)} />
      {shape.data.label ? (
        <MultilineText
          text={shape.data.label as string}
          x={w / 2}
          y={h + 16}
          fontSize={12}
          fill={BPMN_COLORS.text}
          centerVertically={false}
        />
      ) : null}
    </g>
  );
}

export function registerGatewayShapes() {
  const definitions: ShapeDefinition[] = [
    {
      type: "bpmn.gateway.exclusive",
      drawingType: "BPMN 2.0",
      category: "Gateways",
      label: "Exklusiv (XOR)",
      defaultSize: GATEWAY_SIZE,
      ports: GATEWAY_PORTS,
      defaultData: { gatewayType: "exclusive" satisfies GatewayKind },
      render: GatewayRender,
    },
    {
      type: "bpmn.gateway.parallel",
      drawingType: "BPMN 2.0",
      category: "Gateways",
      label: "Parallel (AND)",
      defaultSize: GATEWAY_SIZE,
      ports: GATEWAY_PORTS,
      defaultData: { gatewayType: "parallel" satisfies GatewayKind },
      render: GatewayRender,
    },
    {
      type: "bpmn.gateway.inclusive",
      drawingType: "BPMN 2.0",
      category: "Gateways",
      label: "Inklusiv (OR)",
      defaultSize: GATEWAY_SIZE,
      ports: GATEWAY_PORTS,
      defaultData: { gatewayType: "inclusive" satisfies GatewayKind },
      render: GatewayRender,
    },
    {
      type: "bpmn.gateway.none",
      drawingType: "BPMN 2.0",
      category: "Gateways",
      label: "Einfaches Gateway",
      defaultSize: GATEWAY_SIZE,
      ports: GATEWAY_PORTS,
      defaultData: { gatewayType: "none" satisfies GatewayKind },
      render: GatewayRender,
    },
  ];

  definitions.forEach((def) => ShapeRegistry.register(def));
}
