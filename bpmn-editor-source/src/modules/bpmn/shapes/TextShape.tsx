import type { ShapeDefinition, ShapeRenderProps } from "../../../core/shapes/types";
import { ShapeRegistry } from "../../../core/shapes/ShapeRegistry";
import { MultilineText } from "../../../core/canvas/MultilineText";
import { RECTANGLE_PORTS, BPMN_COLORS, resolveFill, resolveStroke, resolveStrokeWidth } from "./constants";

export const TEXT_SIZE = { width: 140, height: 60 };

function TextRender({ shape, isSelected }: ShapeRenderProps) {
  const { width: w, height: h } = shape.size;
  const label = (shape.data.label as string) ?? "Text";
  const showBorder = (shape.data.showBorder as boolean) ?? false;
  const stroke = isSelected ? BPMN_COLORS.strokeSelected : resolveStroke(shape, BPMN_COLORS.stroke);

  return (
    <g transform={`translate(${shape.position.x} ${shape.position.y})`}>
      {/* Ohne Rahmen ist die Fläche dennoch transparent klickbar, damit das
          Element auch ohne sichtbare Kontur normal selektiert/verschoben
          werden kann - sonst träfe man nur die einzelnen Textzeichen. */}
      <rect
        width={w}
        height={h}
        fill={showBorder ? resolveFill(shape, "#ffffff") : "transparent"}
        stroke={showBorder ? stroke : "transparent"}
        strokeWidth={showBorder ? (isSelected ? 2 : resolveStrokeWidth(shape, 1.5)) : 0}
      />
      {isSelected && !showBorder && (
        // Dezente gestrichelte Hilfslinie nur bei Selektion, damit man ohne
        // Rahmen trotzdem die Elementgrenzen erkennt (kein Export-Bestandteil,
        // nur Bildschirm-Feedback - siehe isSelected-Bedingung).
        <rect width={w} height={h} fill="none" stroke={BPMN_COLORS.strokeSelected} strokeWidth={1} strokeDasharray="4 3" />
      )}
      <MultilineText text={label} x={w / 2} y={h / 2} fontSize={14} fill={BPMN_COLORS.text} />
    </g>
  );
}

export function registerTextShape() {
  const definition: ShapeDefinition = {
    type: "text.label",
    drawingType: "BPMN 2.0",
    category: "Text",
    label: "Text",
    defaultSize: TEXT_SIZE,
    ports: RECTANGLE_PORTS,
    defaultData: { label: "Text", showBorder: false },
    render: TextRender,
  };
  ShapeRegistry.register(definition);
}
