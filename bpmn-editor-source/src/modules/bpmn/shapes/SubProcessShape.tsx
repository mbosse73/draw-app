import type { ShapeDefinition, ShapeRenderProps } from "../../../core/shapes/types";
import { ShapeRegistry } from "../../../core/shapes/ShapeRegistry";
import { MultilineText } from "../../../core/canvas/MultilineText";
import { RECTANGLE_PORTS, BPMN_COLORS } from "./constants";

export const SUBPROCESS_COLLAPSED_SIZE = { width: 140, height: 90 };
export const SUBPROCESS_EXPANDED_SIZE = { width: 400, height: 260 };

const MARKER_SIZE = 14;

function SubProcessRender({ shape, isSelected }: ShapeRenderProps) {
  const stroke = isSelected ? BPMN_COLORS.strokeSelected : BPMN_COLORS.stroke;
  const { width: w, height: h } = shape.size;
  const isExpanded = (shape.data.expanded as boolean) ?? false;
  const label = (shape.data.label as string) ?? "Sub-Prozess";

  const markerCx = w / 2;
  const markerCy = h - MARKER_SIZE / 2 - 4;

  return (
    <g transform={`translate(${shape.position.x} ${shape.position.y})`}>
      <rect
        width={w}
        height={h}
        rx={8}
        fill={isExpanded ? "#ffffff" : BPMN_COLORS.taskFill}
        stroke={stroke}
        strokeWidth={isSelected ? 2 : 1.5}
      />
      {!isExpanded && (
        // Eingeklappt: Label mittig wie ein normaler Task
        <MultilineText text={label} x={w / 2} y={h / 2} fontSize={13} fill={BPMN_COLORS.text} />
      )}
      {isExpanded && (
        // Ausgeklappt: Label oben, damit der restliche Bereich für Kindelemente frei bleibt
        <MultilineText text={label} x={w / 2} y={16} fontSize={12} fill={BPMN_COLORS.text} centerVertically={false} />
      )}
      {/* BPMN-Standard-Marker (+/-) unten mittig. Der Klick-Handler zum
          Umschalten wird von der CanvasEngine über ein data-Attribut auf
          diesem <g> erkannt (siehe handleShapeMouseDown), damit das Modul
          selbst keine direkte Store-Abhängigkeit für's Umschalten braucht. */}
      <g data-subprocess-toggle="true" style={{ cursor: "pointer" }}>
        <rect
          x={markerCx - MARKER_SIZE / 2}
          y={markerCy - MARKER_SIZE / 2}
          width={MARKER_SIZE}
          height={MARKER_SIZE}
          rx={2}
          fill="#ffffff"
          stroke={stroke}
          strokeWidth={1.2}
        />
        <line x1={markerCx - 4} y1={markerCy} x2={markerCx + 4} y2={markerCy} stroke={stroke} strokeWidth={1.4} />
        {!isExpanded && (
          <line x1={markerCx} y1={markerCy - 4} x2={markerCx} y2={markerCy + 4} stroke={stroke} strokeWidth={1.4} />
        )}
      </g>
    </g>
  );
}

export function registerSubProcessShape() {
  const definition: ShapeDefinition = {
    type: "bpmn.subProcess",
    drawingType: "BPMN 2.0",
    category: "Aktivitäten",
    label: "Sub-Prozess",
    defaultSize: SUBPROCESS_COLLAPSED_SIZE,
    ports: RECTANGLE_PORTS,
    defaultData: { label: "Sub-Prozess", expanded: false },
    collapsedSize: SUBPROCESS_COLLAPSED_SIZE,
    expandedSize: SUBPROCESS_EXPANDED_SIZE,
    // Sub-Prozesse sind Container (können wie eine Lane Kindelemente
    // aufnehmen), das gilt aber sinnvollerweise nur im ausgeklappten
    // Zustand. Die Core-Engine kennt "isContainer" nur statisch; das
    // eingeklappt/ausgeklappt-Verhalten wird zusätzlich in der CanvasEngine
    // über shape.data.expanded geprüft (siehe dortige Containment-Logik).
    isContainer: true,
    render: SubProcessRender,
  };
  ShapeRegistry.register(definition);
}
