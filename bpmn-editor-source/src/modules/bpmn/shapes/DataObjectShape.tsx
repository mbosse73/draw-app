import type { ShapeDefinition, ShapeRenderProps } from "../../../core/shapes/types";
import { ShapeRegistry } from "../../../core/shapes/ShapeRegistry";
import { MultilineText } from "../../../core/canvas/MultilineText";
import { DATA_OBJECT_SIZE, BPMN_COLORS } from "./constants";

const DATA_OBJECT_PORTS = [
  { id: "top", relativePosition: { x: 0.5, y: 0 } },
  { id: "right", relativePosition: { x: 1, y: 0.5 } },
  { id: "bottom", relativePosition: { x: 0.5, y: 1 } },
  { id: "left", relativePosition: { x: 0, y: 0.5 } },
];

function DataObjectRender({ shape, isSelected }: ShapeRenderProps) {
  const stroke = isSelected ? BPMN_COLORS.strokeSelected : BPMN_COLORS.stroke;
  const { width: w, height: h } = shape.size;
  const fold = w * 0.3; // Größe der umgeknickten Ecke oben rechts

  // Dokument-Umriss mit angeschnittener oberer rechter Ecke
  const outline = `
    M 0 0
    L ${w - fold} 0
    L ${w} ${fold}
    L ${w} ${h}
    L 0 ${h}
    Z
  `;
  const foldLine = `M ${w - fold} 0 L ${w - fold} ${fold} L ${w} ${fold}`;

  return (
    <g transform={`translate(${shape.position.x} ${shape.position.y})`}>
      <path d={outline} fill={BPMN_COLORS.fill} stroke={stroke} strokeWidth={isSelected ? 2 : 1.5} />
      <path d={foldLine} fill="none" stroke={stroke} strokeWidth={isSelected ? 2 : 1.5} />
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

export function registerDataObjectShape() {
  const definition: ShapeDefinition = {
    type: "bpmn.dataObject",
    drawingType: "BPMN 2.0",
    category: "Datenobjekte",
    label: "Datenobjekt",
    defaultSize: DATA_OBJECT_SIZE,
    ports: DATA_OBJECT_PORTS,
    defaultData: { label: "Data" },
    render: DataObjectRender,
  };
  ShapeRegistry.register(definition);
}
