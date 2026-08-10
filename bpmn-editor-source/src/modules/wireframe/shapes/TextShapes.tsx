import type { ShapeDefinition, ShapeRenderProps } from "../../../core/shapes/types";
import { ShapeRegistry } from "../../../core/shapes/ShapeRegistry";
import { MultilineText } from "../../../core/canvas/MultilineText";
import { SketchPaths } from "./SketchPaths";
import { sketchLine, seedFor } from "./sketch";
import { WIREFRAME_COLORS, TEXT_SIZE, PARAGRAPH_SIZE, RECTANGLE_PORTS } from "./constants";

function HeadingRender({ shape }: ShapeRenderProps) {
  const { width: w, height: h } = shape.size;
  const label = (shape.data.label as string) ?? "Überschrift";
  return (
    <g transform={`translate(${shape.position.x} ${shape.position.y})`}>
      <MultilineText text={label} x={w / 2} y={h / 2 + 6} fontSize={20} fill={WIREFRAME_COLORS.text} />
    </g>
  );
}

/** Klassisches Wireframe-Muster (Balsamiq u.a.): Absatztext wird NICHT als
 *  echter Lorem-Ipsum-Text dargestellt, sondern als gekritzelte horizontale
 *  Linien ("greeked text") - signalisiert bewusst "hier steht später Text",
 *  ohne über konkreten Inhalt abzulenken. */
function ParagraphRender({ shape }: ShapeRenderProps) {
  const { width: w, height: h } = shape.size;
  const lineCount = Math.max(2, Math.floor(h / 16));
  return (
    <g transform={`translate(${shape.position.x} ${shape.position.y})`}>
      {Array.from({ length: lineCount }).map((_, i) => {
        const isLast = i === lineCount - 1;
        const lineW = isLast ? w * 0.55 : w;
        return <SketchPaths shape={shape} key={i} paths={sketchLine(0, i * 16, lineW, i * 16, seedFor(shape.id, `l${i}`), { stroke: WIREFRAME_COLORS.accentFill, strokeWidth: 2.4 })} />;
      })}
    </g>
  );
}

function LabelRender({ shape }: ShapeRenderProps) {
  const { width: w, height: h } = shape.size;
  const label = (shape.data.label as string) ?? "Label";
  return (
    <g transform={`translate(${shape.position.x} ${shape.position.y})`}>
      <MultilineText text={label} x={w / 2} y={h / 2 + 4} fontSize={12.5} fill={WIREFRAME_COLORS.text} />
    </g>
  );
}

function LinkRender({ shape }: ShapeRenderProps) {
  const { width: w, height: h } = shape.size;
  const label = (shape.data.label as string) ?? "Link";
  return (
    <g transform={`translate(${shape.position.x} ${shape.position.y})`}>
      <MultilineText text={label} x={w / 2} y={h / 2 + 2} fontSize={12.5} fill={WIREFRAME_COLORS.text} />
      <SketchPaths shape={shape} paths={sketchLine(w * 0.15, h / 2 + 8, w * 0.85, h / 2 + 8, seedFor(shape.id, "underline"), { stroke: WIREFRAME_COLORS.stroke, strokeWidth: 1 })} />
    </g>
  );
}

export function registerTextShapes() {
  const definitions: ShapeDefinition[] = [
    { type: "wireframe.heading", drawingType: "Desktop-Wireframes", category: "Text & Beschriftung", label: "Überschrift", defaultSize: TEXT_SIZE, ports: RECTANGLE_PORTS, defaultData: { label: "Überschrift" }, render: HeadingRender },
    { type: "wireframe.paragraph", drawingType: "Desktop-Wireframes", category: "Text & Beschriftung", label: "Absatz-Platzhalter", defaultSize: PARAGRAPH_SIZE, ports: RECTANGLE_PORTS, defaultData: {}, render: ParagraphRender },
    { type: "wireframe.label", drawingType: "Desktop-Wireframes", category: "Text & Beschriftung", label: "Label", defaultSize: { width: 100, height: 20 }, ports: RECTANGLE_PORTS, defaultData: { label: "Label" }, render: LabelRender },
    { type: "wireframe.link", drawingType: "Desktop-Wireframes", category: "Text & Beschriftung", label: "Link/Hyperlink", defaultSize: { width: 100, height: 22 }, ports: RECTANGLE_PORTS, defaultData: { label: "Link" }, render: LinkRender },
  ];
  definitions.forEach((def) => ShapeRegistry.register(def));
}
