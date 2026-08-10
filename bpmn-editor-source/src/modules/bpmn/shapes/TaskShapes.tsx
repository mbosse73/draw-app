import type { ShapeDefinition, ShapeRenderProps } from "../../../core/shapes/types";
import { ShapeRegistry } from "../../../core/shapes/ShapeRegistry";
import { MultilineText } from "../../../core/canvas/MultilineText";
import { TASK_SIZE, RECTANGLE_PORTS, BPMN_COLORS } from "./constants";

type TaskKind = "user" | "service" | "manual" | "none";

/** Kleines Icon oben links in der Task-Box, je nach Task-Typ. */
function TaskIcon({ kind }: { kind: TaskKind }) {
  const x = 8;
  const y = 8;
  const size = 16;

  if (kind === "none") {
    return null; // einfacher Task ohne Symbol
  }

  if (kind === "user") {
    // Einfaches Personen-Symbol (Kopf + Schultern)
    return (
      <g transform={`translate(${x} ${y})`} stroke={BPMN_COLORS.icon} strokeWidth={1.3} fill="none">
        <circle cx={size / 2} cy={size * 0.3} r={size * 0.22} />
        <path d={`M ${size * 0.15} ${size} C ${size * 0.15} ${size * 0.6}, ${size * 0.85} ${size * 0.6}, ${size * 0.85} ${size}`} />
      </g>
    );
  }
  if (kind === "service") {
    // Zahnrad-artiges Symbol (vereinfacht als Kreis mit Zacken)
    return (
      <g transform={`translate(${x} ${y})`} stroke={BPMN_COLORS.icon} strokeWidth={1.3} fill="none">
        <circle cx={size / 2} cy={size / 2} r={size * 0.28} />
        {[0, 60, 120, 180, 240, 300].map((angle) => {
          const rad = (angle * Math.PI) / 180;
          const cx = size / 2 + Math.cos(rad) * size * 0.28;
          const cy = size / 2 + Math.sin(rad) * size * 0.28;
          const cx2 = size / 2 + Math.cos(rad) * size * 0.46;
          const cy2 = size / 2 + Math.sin(rad) * size * 0.46;
          return <line key={angle} x1={cx} y1={cy} x2={cx2} y2={cy2} />;
        })}
      </g>
    );
  }
  // manual: stilisierte Hand (vereinfacht als Rechteck mit Fingern)
  return (
    <g transform={`translate(${x} ${y})`} stroke={BPMN_COLORS.icon} strokeWidth={1.3} fill="none">
      <path
        d={`M ${size * 0.2} ${size * 0.9} L ${size * 0.2} ${size * 0.4} C ${size * 0.2} ${size * 0.3}, ${size * 0.35} ${size * 0.3}, ${size * 0.35} ${size * 0.4} L ${size * 0.35} ${size * 0.6} L ${size * 0.5} ${size * 0.6} L ${size * 0.5} ${size * 0.3} C ${size * 0.5} ${size * 0.2}, ${size * 0.65} ${size * 0.2}, ${size * 0.65} ${size * 0.3} L ${size * 0.65} ${size * 0.6} L ${size * 0.85} ${size * 0.65} L ${size * 0.85} ${size * 0.9} Z`}
      />
    </g>
  );
}

function TaskRender({ shape, isSelected }: ShapeRenderProps) {
  const kind = (shape.data.taskType as TaskKind) ?? "user";
  const stroke = isSelected ? BPMN_COLORS.strokeSelected : BPMN_COLORS.stroke;

  return (
    <g transform={`translate(${shape.position.x} ${shape.position.y})`}>
      <rect
        width={shape.size.width}
        height={shape.size.height}
        rx={8}
        fill={BPMN_COLORS.taskFill}
        stroke={stroke}
        strokeWidth={isSelected ? 2 : 1.5}
      />
      <TaskIcon kind={kind} />
      <MultilineText
        text={(shape.data.label as string) ?? taskLabel(kind)}
        x={shape.size.width / 2}
        y={shape.size.height / 2 + 6}
        fontSize={13}
        fill={BPMN_COLORS.text}
      />
    </g>
  );
}

function taskLabel(kind: TaskKind): string {
  if (kind === "user") return "User Task";
  if (kind === "service") return "Service Task";
  if (kind === "manual") return "Manual Task";
  return "Task";
}

export function registerTaskShapes() {
  const definitions: ShapeDefinition[] = [
    {
      type: "bpmn.task.none",
      drawingType: "BPMN 2.0",
      category: "Aktivitäten",
      label: "Task",
      defaultSize: TASK_SIZE,
      ports: RECTANGLE_PORTS,
      defaultData: { taskType: "none" satisfies TaskKind, label: "Task" },
      render: TaskRender,
    },
    {
      type: "bpmn.task.user",
      drawingType: "BPMN 2.0",
      category: "Aktivitäten",
      label: "User Task",
      defaultSize: TASK_SIZE,
      ports: RECTANGLE_PORTS,
      defaultData: { taskType: "user" satisfies TaskKind, label: "User Task" },
      render: TaskRender,
    },
    {
      type: "bpmn.task.service",
      drawingType: "BPMN 2.0",
      category: "Aktivitäten",
      label: "Service Task",
      defaultSize: TASK_SIZE,
      ports: RECTANGLE_PORTS,
      defaultData: { taskType: "service" satisfies TaskKind, label: "Service Task" },
      render: TaskRender,
    },
    {
      type: "bpmn.task.manual",
      drawingType: "BPMN 2.0",
      category: "Aktivitäten",
      label: "Manueller Task",
      defaultSize: TASK_SIZE,
      ports: RECTANGLE_PORTS,
      defaultData: { taskType: "manual" satisfies TaskKind, label: "Manual Task" },
      render: TaskRender,
    },
  ];

  definitions.forEach((def) => ShapeRegistry.register(def));
}
