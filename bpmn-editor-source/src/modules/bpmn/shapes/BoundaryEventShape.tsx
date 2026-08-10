import type { ShapeDefinition, ShapeRenderProps } from "../../../core/shapes/types";
import { ShapeRegistry } from "../../../core/shapes/ShapeRegistry";
import { MultilineText } from "../../../core/canvas/MultilineText";
import { BPMN_COLORS, resolveFill, resolveStroke } from "./constants";

export const BOUNDARY_EVENT_SIZE = { width: 32, height: 32 };

type BoundaryTrigger = "timer" | "message" | "error";

const BOUNDARY_PORTS = [
  { id: "top", relativePosition: { x: 0.5, y: 0 } },
  { id: "right", relativePosition: { x: 1, y: 0.5 } },
  { id: "bottom", relativePosition: { x: 0.5, y: 1 } },
  { id: "left", relativePosition: { x: 0, y: 0.5 } },
];

function BoundaryTriggerIcon({ trigger, r }: { trigger: BoundaryTrigger; r: number }) {
  const stroke = BPMN_COLORS.icon;
  const s = r * 0.85;

  if (trigger === "timer") {
    return (
      <g stroke={stroke} strokeWidth={1.1} fill="none">
        <circle cx={r} cy={r} r={s * 0.6} />
        <line x1={r} y1={r} x2={r} y2={r - s * 0.38} />
        <line x1={r} y1={r} x2={r + s * 0.26} y2={r} />
      </g>
    );
  }
  if (trigger === "message") {
    const w = s * 0.85;
    const h = s * 0.55;
    const x = r - w / 2;
    const y = r - h / 2;
    return (
      <g stroke={stroke} strokeWidth={1} fill="none">
        <rect x={x} y={y} width={w} height={h} />
        <path d={`M ${x} ${y} L ${r} ${y + h * 0.55} L ${x + w} ${y}`} />
      </g>
    );
  }
  // error
  const path = `M ${r - s * 0.3} ${r + s * 0.45} L ${r - s * 0.04} ${r - s * 0.08} L ${r + s * 0.13} ${r + s * 0.13} L ${r + s * 0.35} ${r - s * 0.48}`;
  return <path d={path} stroke={stroke} strokeWidth={1.4} fill="none" strokeLinejoin="round" strokeLinecap="round" />;
}

function BoundaryEventRender({ shape, isSelected }: ShapeRenderProps) {
  const trigger = (shape.data.trigger as BoundaryTrigger) ?? "timer";
  // "interrupting" (Standard, durchgezogener Doppelkreis) vs. "non-interrupting"
  // (gestrichelter Doppelkreis) - BPMN-Standard-Unterscheidung, ob das Event
  // den Host-Task beim Auslösen unterbricht oder parallel weiterläuft.
  const isInterrupting = (shape.data.interrupting as boolean) ?? true;
  const r = shape.size.width / 2;
  const stroke = isSelected ? BPMN_COLORS.strokeSelected : resolveStroke(shape, BPMN_COLORS.stroke);
  const dash = isInterrupting ? undefined : "3 2";

  return (
    <g transform={`translate(${shape.position.x} ${shape.position.y})`}>
      <circle cx={r} cy={r} r={r - 1} fill={resolveFill(shape, BPMN_COLORS.fill)} stroke={stroke} strokeWidth={2} strokeDasharray={dash} />
      <circle cx={r} cy={r} r={r - 5} fill="none" stroke={stroke} strokeWidth={1.3} strokeDasharray={dash} />
      <BoundaryTriggerIcon trigger={trigger} r={r} />
      {shape.data.label ? (
        <MultilineText
          text={shape.data.label as string}
          x={r}
          y={shape.size.height + 12}
          fontSize={11}
          fill={BPMN_COLORS.text}
          centerVertically={false}
        />
      ) : null}
    </g>
  );
}

export function registerBoundaryEventShape() {
  const definitions: ShapeDefinition[] = [
    {
      type: "bpmn.boundaryEvent.timer",
      drawingType: "BPMN 2.0",
      category: "Boundary Events",
      label: "Boundary (Timer)",
      defaultSize: BOUNDARY_EVENT_SIZE,
      ports: BOUNDARY_PORTS,
      defaultData: { trigger: "timer" satisfies BoundaryTrigger, interrupting: true },
      isAttachable: true,
      render: BoundaryEventRender,
    },
    {
      type: "bpmn.boundaryEvent.message",
      drawingType: "BPMN 2.0",
      category: "Boundary Events",
      label: "Boundary (Nachricht)",
      defaultSize: BOUNDARY_EVENT_SIZE,
      ports: BOUNDARY_PORTS,
      defaultData: { trigger: "message" satisfies BoundaryTrigger, interrupting: true },
      isAttachable: true,
      render: BoundaryEventRender,
    },
    {
      type: "bpmn.boundaryEvent.error",
      drawingType: "BPMN 2.0",
      category: "Boundary Events",
      label: "Boundary (Fehler)",
      defaultSize: BOUNDARY_EVENT_SIZE,
      ports: BOUNDARY_PORTS,
      defaultData: { trigger: "error" satisfies BoundaryTrigger, interrupting: true },
      isAttachable: true,
      render: BoundaryEventRender,
    },
  ];
  definitions.forEach((def) => ShapeRegistry.register(def));
}
