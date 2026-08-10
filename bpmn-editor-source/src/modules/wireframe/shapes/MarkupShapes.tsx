import type { ShapeDefinition, ShapeRenderProps } from "../../../core/shapes/types";
import { ShapeRegistry } from "../../../core/shapes/ShapeRegistry";
import { MultilineText } from "../../../core/canvas/MultilineText";
import { SketchPaths } from "./SketchPaths";
import { sketchPath, sketchRoundedRect, seedFor } from "./sketch";
import { WIREFRAME_COLORS, RECTANGLE_PORTS } from "./constants";

function CommentBubbleRender({ shape, isSelected }: ShapeRenderProps) {
  const stroke = isSelected ? WIREFRAME_COLORS.strokeSelected : WIREFRAME_COLORS.stroke;
  const { width: w, height: h } = shape.size;
  const label = (shape.data.label as string) ?? "Hinweis";
  const tailW = Math.min(20, w * 0.2);
  const bodyH = h - 14;
  const d = `M 2 2 L ${w - 2} 2 L ${w - 2} ${bodyH} L ${tailW * 2} ${bodyH} L ${tailW} ${h - 2} L ${tailW} ${bodyH} L 2 ${bodyH} Z`;
  return (
    <g transform={`translate(${shape.position.x} ${shape.position.y})`}>
      <SketchPaths shape={shape} paths={sketchPath(d, seedFor(shape.id), { stroke, fill: "#fff8e0", fillStyle: "solid" })} />
      <MultilineText text={label} x={w / 2} y={bodyH / 2 + 4} fontSize={12} fill={WIREFRAME_COLORS.text} />
    </g>
  );
}

function HighlightBoxRender({ shape, isSelected }: ShapeRenderProps) {
  const stroke = isSelected ? WIREFRAME_COLORS.strokeSelected : "#c0392b";
  const { width: w, height: h } = shape.size;
  return (
    <g transform={`translate(${shape.position.x} ${shape.position.y})`}>
      <SketchPaths shape={shape} paths={sketchRoundedRect(w, h, seedFor(shape.id), { stroke, strokeWidth: 1.8, strokeLineDash: [6, 4] }, 4)} />
    </g>
  );
}

/** Kleine, schmale Sprechblase ohne Rahmen-Ecken (Tooltip) - Unterschied zur
 *  Kommentarblase: kompakter, einzeiliger Hover-Hinweis statt mehrzeiliger Notiz. */
function TooltipRender({ shape, isSelected }: ShapeRenderProps) {
  const stroke = isSelected ? WIREFRAME_COLORS.strokeSelected : WIREFRAME_COLORS.stroke;
  const { width: w, height: h } = shape.size;
  const label = (shape.data.label as string) ?? "Tooltip-Text";
  const tailW = 10;
  const bodyH = h - 8;
  const d = `M 2 2 L ${w - 2} 2 L ${w - 2} ${bodyH} L ${w / 2 + tailW} ${bodyH} L ${w / 2} ${h - 2} L ${w / 2 - tailW} ${bodyH} L 2 ${bodyH} Z`;
  return (
    <g transform={`translate(${shape.position.x} ${shape.position.y})`}>
      <SketchPaths shape={shape} paths={sketchPath(d, seedFor(shape.id), { stroke, fill: "#333333", fillStyle: "solid" })} />
      <MultilineText text={label} x={w / 2} y={bodyH / 2 + 4} fontSize={11} fill="#ffffff" />
    </g>
  );
}

export function registerMarkupShapes() {
  const definitions: ShapeDefinition[] = [
    { type: "wireframe.commentBubble", drawingType: "Desktop-Wireframes", category: "Markup & Notizen", label: "Kommentarblase", defaultSize: { width: 150, height: 90 }, ports: RECTANGLE_PORTS, defaultData: { label: "Hinweis" }, render: CommentBubbleRender },
    { type: "wireframe.highlightBox", drawingType: "Desktop-Wireframes", category: "Markup & Notizen", label: "Hervorhebungsrahmen", defaultSize: { width: 160, height: 100 }, ports: RECTANGLE_PORTS, defaultData: {}, render: HighlightBoxRender },
    { type: "wireframe.tooltip", drawingType: "Desktop-Wireframes", category: "Markup & Notizen", label: "Tooltip", defaultSize: { width: 120, height: 44 }, ports: RECTANGLE_PORTS, defaultData: { label: "Tooltip-Text" }, render: TooltipRender },
  ];
  definitions.forEach((def) => ShapeRegistry.register(def));
}
