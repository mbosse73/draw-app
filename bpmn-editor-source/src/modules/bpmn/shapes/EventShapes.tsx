import type { ShapeDefinition, ShapeRenderProps } from "../../../core/shapes/types";
import { ShapeRegistry } from "../../../core/shapes/ShapeRegistry";
import { MultilineText } from "../../../core/canvas/MultilineText";
import { EVENT_SIZE, BPMN_COLORS } from "./constants";

type EventKind = "start" | "intermediate" | "end";
type EventTrigger = "none" | "timer" | "message" | "error";

const EVENT_PORTS = [
  { id: "top", relativePosition: { x: 0.5, y: 0 } },
  { id: "right", relativePosition: { x: 1, y: 0.5 } },
  { id: "bottom", relativePosition: { x: 0.5, y: 1 } },
  { id: "left", relativePosition: { x: 0, y: 0.5 } },
];

/** Trigger-Symbol mittig im Event-Kreis, analog zum BPMN-2.0-Standard-Symbolsatz. */
function TriggerIcon({ trigger, r }: { trigger: EventTrigger; r: number }) {
  const stroke = BPMN_COLORS.icon;
  const s = r * 0.85; // Icon-Radius, etwas kleiner als der Event-Kreis

  if (trigger === "timer") {
    // Uhr-Symbol: Kreis mit Zeigern
    return (
      <g stroke={stroke} strokeWidth={1.3} fill="none">
        <circle cx={r} cy={r} r={s * 0.62} />
        <line x1={r} y1={r} x2={r} y2={r - s * 0.4} />
        <line x1={r} y1={r} x2={r + s * 0.28} y2={r} />
        {/* Kleine Markierungen bei 12/3/6/9 Uhr für den typischen Zifferblatt-Look */}
        {[0, 90, 180, 270].map((deg) => {
          const rad = (deg * Math.PI) / 180;
          const x1 = r + Math.sin(rad) * s * 0.55;
          const y1 = r - Math.cos(rad) * s * 0.55;
          const x2 = r + Math.sin(rad) * s * 0.62;
          const y2 = r - Math.cos(rad) * s * 0.62;
          return <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} />;
        })}
      </g>
    );
  }

  if (trigger === "message") {
    // Umschlag-Symbol: Rechteck mit diagonalen Linien
    const w = s * 0.9;
    const h = s * 0.6;
    const x = r - w / 2;
    const y = r - h / 2;
    return (
      <g stroke={stroke} strokeWidth={1.2} fill="none">
        <rect x={x} y={y} width={w} height={h} />
        <path d={`M ${x} ${y} L ${r} ${y + h * 0.55} L ${x + w} ${y}`} />
      </g>
    );
  }

  if (trigger === "error") {
    // Blitz-Symbol (Zickzack), typisch für BPMN Error-Events
    const path = `M ${r - s * 0.35} ${r + s * 0.5} L ${r - s * 0.05} ${r - s * 0.1} L ${r + s * 0.15} ${r + s * 0.15} L ${r + s * 0.4} ${r - s * 0.55}`;
    return <path d={path} stroke={stroke} strokeWidth={1.6} fill="none" strokeLinejoin="round" strokeLinecap="round" />;
  }

  return null; // "none": kein Symbol, klassischer leerer Kreis
}

function EventRender({ shape, isSelected }: ShapeRenderProps) {
  const kind = (shape.data.eventType as EventKind) ?? "start";
  const trigger = (shape.data.trigger as EventTrigger) ?? "none";
  const r = shape.size.width / 2;
  const stroke = isSelected ? BPMN_COLORS.strokeSelected : BPMN_COLORS.stroke;

  // Start: dünner Rand. Intermediate: doppelter Rand. End: dicker Rand.
  const strokeWidth = kind === "end" ? 3.5 : 2;

  return (
    <g transform={`translate(${shape.position.x} ${shape.position.y})`}>
      <circle cx={r} cy={r} r={r - strokeWidth / 2} fill={BPMN_COLORS.fill} stroke={stroke} strokeWidth={strokeWidth} />
      {kind === "intermediate" && (
        <circle cx={r} cy={r} r={r - strokeWidth - 2.5} fill="none" stroke={stroke} strokeWidth={1.5} />
      )}
      <TriggerIcon trigger={trigger} r={r} />
      {shape.data.label ? (
        <MultilineText
          text={shape.data.label as string}
          x={r}
          y={shape.size.height + 14}
          fontSize={12}
          fill={BPMN_COLORS.text}
          centerVertically={false}
        />
      ) : null}
    </g>
  );
}

function makeEventDefinition(
  type: string,
  label: string,
  eventType: EventKind,
  trigger: EventTrigger
): ShapeDefinition {
  return {
    type,
    drawingType: "BPMN 2.0",
    category: "Ereignisse",
    label,
    defaultSize: EVENT_SIZE,
    ports: EVENT_PORTS,
    defaultData: { eventType, trigger },
    render: EventRender,
  };
}

export function registerEventShapes() {
  const definitions: ShapeDefinition[] = [
    makeEventDefinition("bpmn.event.start", "Start-Ereignis", "start", "none"),
    makeEventDefinition("bpmn.event.start.timer", "Start (Timer)", "start", "timer"),
    makeEventDefinition("bpmn.event.start.message", "Start (Nachricht)", "start", "message"),
    makeEventDefinition("bpmn.event.intermediate", "Zwischenereignis", "intermediate", "none"),
    makeEventDefinition("bpmn.event.intermediate.timer", "Zwischenereignis (Timer)", "intermediate", "timer"),
    makeEventDefinition("bpmn.event.intermediate.message", "Zwischenereignis (Nachricht)", "intermediate", "message"),
    makeEventDefinition("bpmn.event.end", "End-Ereignis", "end", "none"),
    makeEventDefinition("bpmn.event.end.error", "End (Fehler)", "end", "error"),
    makeEventDefinition("bpmn.event.end.message", "End (Nachricht)", "end", "message"),
  ];

  definitions.forEach((def) => ShapeRegistry.register(def));
}
