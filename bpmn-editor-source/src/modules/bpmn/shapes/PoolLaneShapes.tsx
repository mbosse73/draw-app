import type { ShapeDefinition, ShapeRenderProps } from "../../../core/shapes/types";
import { ShapeRegistry } from "../../../core/shapes/ShapeRegistry";
import { MultilineText } from "../../../core/canvas/MultilineText";
import { BPMN_COLORS, resolveFill, resolveStroke, resolveStrokeWidth } from "./constants";

const TITLE_BAND_WIDTH = 24;

export const POOL_DEFAULT_SIZE = { width: 700, height: 200 };
export const LANE_DEFAULT_SIZE = { width: 700, height: 150 };

// Pools/Lanes haben bewusst keine Ports: Verbindungen sollen zwischen den
// Aktivitäten *innerhalb* der Lane laufen, nicht zum Container selbst.
const CONTAINER_PORTS: never[] = [];

function PoolRender({ shape, isSelected }: ShapeRenderProps) {
  const stroke = isSelected ? BPMN_COLORS.strokeSelected : resolveStroke(shape, BPMN_COLORS.stroke);
  const { width: w, height: h } = shape.size;
  const label = (shape.data.label as string) ?? "Pool";

  return (
    <g transform={`translate(${shape.position.x} ${shape.position.y})`}>
      <rect width={w} height={h} fill={resolveFill(shape, "#ffffff")} stroke={stroke} strokeWidth={isSelected ? 2 : resolveStrokeWidth(shape, 1.5)} />
      {/* Titel-Band links, vertikal beschriftet */}
      <rect width={TITLE_BAND_WIDTH} height={h} fill="#eef1f8" stroke={stroke} strokeWidth={isSelected ? 2 : 1.5} />
      <g transform={`translate(${TITLE_BAND_WIDTH / 2} ${h / 2}) rotate(-90)`}>
        <MultilineText text={label} x={0} y={0} fontSize={13} fill={BPMN_COLORS.text} />
      </g>
    </g>
  );
}

function LaneRender({ shape, isSelected }: ShapeRenderProps) {
  const stroke = isSelected ? BPMN_COLORS.strokeSelected : resolveStroke(shape, BPMN_COLORS.stroke);
  const { width: w, height: h } = shape.size;
  const label = (shape.data.label as string) ?? "Lane";

  return (
    <g transform={`translate(${shape.position.x} ${shape.position.y})`}>
      {/* Nur ein leichter Hintergrund + untere Trennlinie, damit sich mehrere
          Lanes innerhalb eines Pools optisch stapeln lassen, ohne sich
          gegenseitig mit vollen Rahmen zu überdecken. */}
      <rect width={w} height={h} fill={resolveFill(shape, "rgba(255,255,255,0.4)")} stroke={stroke} strokeWidth={isSelected ? 2 : resolveStrokeWidth(shape, 1)} strokeDasharray={isSelected ? undefined : "0"} />
      <rect width={TITLE_BAND_WIDTH} height={h} fill="#f6f7fa" stroke={stroke} strokeWidth={isSelected ? 2 : 1} />
      <g transform={`translate(${TITLE_BAND_WIDTH / 2} ${h / 2}) rotate(-90)`}>
        <MultilineText text={label} x={0} y={0} fontSize={12} fill={BPMN_COLORS.text} />
      </g>
    </g>
  );
}

export function registerPoolAndLaneShapes() {
  const poolDefinition: ShapeDefinition = {
    type: "bpmn.pool",
    drawingType: "BPMN 2.0",
    category: "Pools & Lanes",
    label: "Pool",
    defaultSize: POOL_DEFAULT_SIZE,
    ports: CONTAINER_PORTS,
    defaultData: { label: "Pool" },
    isContainer: true,
    render: PoolRender,
  };

  const laneDefinition: ShapeDefinition = {
    type: "bpmn.lane",
    drawingType: "BPMN 2.0",
    category: "Pools & Lanes",
    label: "Lane",
    defaultSize: LANE_DEFAULT_SIZE,
    ports: CONTAINER_PORTS,
    defaultData: { label: "Lane" },
    isContainer: true,
    render: LaneRender,
  };

  ShapeRegistry.register(poolDefinition);
  ShapeRegistry.register(laneDefinition);
}
