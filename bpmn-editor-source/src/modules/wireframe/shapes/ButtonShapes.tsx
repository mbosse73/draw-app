import type { ShapeDefinition, ShapeRenderProps } from "../../../core/shapes/types";
import { ShapeRegistry } from "../../../core/shapes/ShapeRegistry";
import { MultilineText } from "../../../core/canvas/MultilineText";
import { SketchPaths } from "./SketchPaths";
import { sketchRoundedRect, sketchCircle, sketchLine, sketchSparkle, seedFor, parseItems } from "./sketch";
import { WIREFRAME_COLORS, BUTTON_SIZE, SMALL_SIZE, RECTANGLE_PORTS } from "./constants";

function ButtonRender({ shape, isSelected }: ShapeRenderProps) {
  const stroke = isSelected ? WIREFRAME_COLORS.strokeSelected : WIREFRAME_COLORS.stroke;
  const { width: w, height: h } = shape.size;
  const label = (shape.data.label as string) ?? "Button";
  return (
    <g transform={`translate(${shape.position.x} ${shape.position.y})`}>
      <SketchPaths shape={shape} paths={sketchRoundedRect(w, h, seedFor(shape.id), { stroke, strokeWidth: 2, fill: WIREFRAME_COLORS.fillLight })} />
      <MultilineText text={label} x={w / 2} y={h / 2 + 4} fontSize={12.5} fill={WIREFRAME_COLORS.text} />
    </g>
  );
}

/** Sinnbild statt leerem Kreis: ein Stern/Funken (dieselbe Primitive wie
 *  wireframe.icon), damit sofort erkennbar ist "Button MIT Icon drauf" statt
 *  eines beliebigen runden Platzhaltersymbols. */
function IconButtonRender({ shape, isSelected }: ShapeRenderProps) {
  const stroke = isSelected ? WIREFRAME_COLORS.strokeSelected : WIREFRAME_COLORS.stroke;
  const { width: w, height: h } = shape.size;
  return (
    <g transform={`translate(${shape.position.x} ${shape.position.y})`}>
      <SketchPaths shape={shape} paths={sketchRoundedRect(w, h, seedFor(shape.id), { stroke, fill: "#ffffff" })} />
      <SketchPaths shape={shape} paths={sketchSparkle(w / 2, h / 2, Math.min(w, h) * 0.32, seedFor(shape.id, "glyph"), { stroke, fill: WIREFRAME_COLORS.fillLight, fillStyle: "solid" })} />
    </g>
  );
}

function ToggleSwitchRender({ shape, isSelected }: ShapeRenderProps) {
  const stroke = isSelected ? WIREFRAME_COLORS.strokeSelected : WIREFRAME_COLORS.stroke;
  const { width: w, height: h } = shape.size;
  const on = (shape.data.on as boolean) ?? true;
  const handleX = on ? w - h / 2 : h / 2;
  return (
    <g transform={`translate(${shape.position.x} ${shape.position.y})`}>
      <SketchPaths shape={shape} paths={sketchRoundedRect(w, h, seedFor(shape.id), { stroke, fill: on ? WIREFRAME_COLORS.fillLight : "#ffffff" }, h / 2)} />
      <SketchPaths shape={shape} paths={sketchCircle(handleX, h / 2, h * 0.7, seedFor(shape.id, "handle"), { stroke, fill: "#ffffff" })} />
    </g>
  );
}

function SegmentedControlRender({ shape, isSelected }: ShapeRenderProps) {
  const stroke = isSelected ? WIREFRAME_COLORS.strokeSelected : WIREFRAME_COLORS.stroke;
  const { width: w, height: h } = shape.size;
  const items = parseItems(shape.data.items, ["Liste", "Raster"]);
  const segW = w / items.length;
  return (
    <g transform={`translate(${shape.position.x} ${shape.position.y})`}>
      <SketchPaths shape={shape} paths={sketchRoundedRect(w, h, seedFor(shape.id), { stroke, fill: "#ffffff" })} />
      {items.map((item, i) => (
        <g key={i}>
          {i > 0 && <SketchPaths shape={shape} paths={sketchLine(segW * i, 0, segW * i, h, seedFor(shape.id, `sep${i}`), { stroke, strokeWidth: 1.2 })} />}
          <MultilineText text={item} x={segW * i + segW / 2} y={h / 2 + 4} fontSize={11.5} fill={WIREFRAME_COLORS.text} />
        </g>
      ))}
    </g>
  );
}

export function registerButtonShapes() {
  const definitions: ShapeDefinition[] = [
    { type: "wireframe.button", drawingType: "Desktop-Wireframes", category: "Schaltflächen", label: "Standard-Button", defaultSize: BUTTON_SIZE, ports: RECTANGLE_PORTS, defaultData: { label: "Button" }, render: ButtonRender },
    { type: "wireframe.iconButton", drawingType: "Desktop-Wireframes", category: "Schaltflächen", label: "Icon-Button", defaultSize: SMALL_SIZE, ports: RECTANGLE_PORTS, defaultData: {}, render: IconButtonRender },
    { type: "wireframe.toggleSwitch", drawingType: "Desktop-Wireframes", category: "Schaltflächen", label: "Umschalter", defaultSize: { width: 46, height: 24 }, ports: RECTANGLE_PORTS, defaultData: { on: true }, render: ToggleSwitchRender },
    { type: "wireframe.segmentedControl", drawingType: "Desktop-Wireframes", category: "Schaltflächen", label: "Segmented Control", defaultSize: { width: 160, height: 30 }, ports: RECTANGLE_PORTS, defaultData: { items: "Liste\nRaster" }, render: SegmentedControlRender },
  ];
  definitions.forEach((def) => ShapeRegistry.register(def));
}
