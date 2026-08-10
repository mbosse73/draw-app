import type { ShapeDefinition, ShapeRenderProps } from "../../../core/shapes/types";
import { ShapeRegistry } from "../../../core/shapes/ShapeRegistry";
import { MultilineText } from "../../../core/canvas/MultilineText";
import { SketchPaths } from "./SketchPaths";
import { sketchRoundedRect, sketchLine, sketchCircle, sketchPath, seedFor } from "./sketch";
import { WIREFRAME_COLORS, FIELD_SIZE, SMALL_SIZE, RECTANGLE_PORTS } from "./constants";

function TextFieldRender({ shape, isSelected }: ShapeRenderProps) {
  const stroke = isSelected ? WIREFRAME_COLORS.strokeSelected : WIREFRAME_COLORS.stroke;
  const { width: w, height: h } = shape.size;
  const label = (shape.data.label as string) ?? "";
  return (
    <g transform={`translate(${shape.position.x} ${shape.position.y})`}>
      <SketchPaths shape={shape} paths={sketchRoundedRect(w, h, seedFor(shape.id), { stroke, fill: "#ffffff" })} />
      {label && <MultilineText text={label} x={8} y={h / 2 + 4} fontSize={11.5} fill="#999999" textAnchor="start" centerVertically={false} />}
    </g>
  );
}

function TextAreaRender({ shape, isSelected }: ShapeRenderProps) {
  const stroke = isSelected ? WIREFRAME_COLORS.strokeSelected : WIREFRAME_COLORS.stroke;
  const { width: w, height: h } = shape.size;
  const lineCount = Math.max(1, Math.floor((h - 16) / 16));
  return (
    <g transform={`translate(${shape.position.x} ${shape.position.y})`}>
      <SketchPaths shape={shape} paths={sketchRoundedRect(w, h, seedFor(shape.id), { stroke, fill: "#ffffff" })} />
      {Array.from({ length: lineCount }).map((_, i) => (
        <SketchPaths shape={shape} key={i} paths={sketchLine(8, 14 + i * 16, w - 8 - (i === lineCount - 1 ? w * 0.35 : 0), 14 + i * 16, seedFor(shape.id, `l${i}`), { stroke: WIREFRAME_COLORS.accentFill, strokeWidth: 2 })} />
      ))}
    </g>
  );
}

function CheckboxRender({ shape, isSelected }: ShapeRenderProps) {
  const stroke = isSelected ? WIREFRAME_COLORS.strokeSelected : WIREFRAME_COLORS.stroke;
  const { height: h } = shape.size;
  const box = Math.min(18, h);
  const checked = (shape.data.checked as boolean) ?? true;
  const label = (shape.data.label as string) ?? "Option";
  return (
    <g transform={`translate(${shape.position.x} ${shape.position.y})`}>
      <SketchPaths shape={shape} paths={sketchRoundedRect(box, box, seedFor(shape.id), { stroke })} />
      {checked && <SketchPaths shape={shape} paths={sketchPath(`M ${box * 0.2} ${box * 0.55} L ${box * 0.42} ${box * 0.78} L ${box * 0.82} ${box * 0.22}`, seedFor(shape.id, "check"), { stroke, strokeWidth: 1.8 })} />}
      <MultilineText text={label} x={box + 8} y={h / 2 + 4} fontSize={12} fill={WIREFRAME_COLORS.text} textAnchor="start" centerVertically={false} />
    </g>
  );
}

function RadioRender({ shape, isSelected }: ShapeRenderProps) {
  const stroke = isSelected ? WIREFRAME_COLORS.strokeSelected : WIREFRAME_COLORS.stroke;
  const { height: h } = shape.size;
  const d = Math.min(18, h);
  const checked = (shape.data.checked as boolean) ?? true;
  const label = (shape.data.label as string) ?? "Option";
  return (
    <g transform={`translate(${shape.position.x} ${shape.position.y})`}>
      <SketchPaths shape={shape} paths={sketchCircle(d / 2, h / 2, d, seedFor(shape.id), { stroke })} />
      {checked && <SketchPaths shape={shape} paths={sketchCircle(d / 2, h / 2, d * 0.4, seedFor(shape.id, "dot"), { stroke, fill: stroke, fillStyle: "solid", roughness: 0.4 })} />}
      <MultilineText text={label} x={d + 10} y={h / 2 + 4} fontSize={12} fill={WIREFRAME_COLORS.text} textAnchor="start" centerVertically={false} />
    </g>
  );
}

function ComboboxRender({ shape, isSelected }: ShapeRenderProps) {
  const stroke = isSelected ? WIREFRAME_COLORS.strokeSelected : WIREFRAME_COLORS.stroke;
  const { width: w, height: h } = shape.size;
  const label = (shape.data.label as string) ?? "Bitte wählen…";
  return (
    <g transform={`translate(${shape.position.x} ${shape.position.y})`}>
      <SketchPaths shape={shape} paths={sketchRoundedRect(w, h, seedFor(shape.id), { stroke, fill: "#ffffff" })} />
      <SketchPaths shape={shape} paths={sketchPath(`M ${w - 22} ${h / 2 - 3} L ${w - 14} ${h / 2 + 4} L ${w - 6} ${h / 2 - 3}`, seedFor(shape.id, "chev"), { stroke })} />
      <MultilineText text={label} x={8} y={h / 2 + 4} fontSize={11.5} fill={WIREFRAME_COLORS.text} textAnchor="start" centerVertically={false} />
    </g>
  );
}

function SliderRender({ shape, isSelected }: ShapeRenderProps) {
  const stroke = isSelected ? WIREFRAME_COLORS.strokeSelected : WIREFRAME_COLORS.stroke;
  const { width: w, height: h } = shape.size;
  const value = (shape.data.value as number) ?? 0.5;
  const handleX = 10 + value * (w - 20);
  return (
    <g transform={`translate(${shape.position.x} ${shape.position.y})`}>
      <SketchPaths shape={shape} paths={sketchLine(6, h / 2, w - 6, h / 2, seedFor(shape.id), { stroke, strokeWidth: 1.8 })} />
      <SketchPaths shape={shape} paths={sketchCircle(handleX, h / 2, 14, seedFor(shape.id, "handle"), { stroke, fill: "#ffffff" })} />
    </g>
  );
}

function SpinnerRender({ shape, isSelected }: ShapeRenderProps) {
  const stroke = isSelected ? WIREFRAME_COLORS.strokeSelected : WIREFRAME_COLORS.stroke;
  const { width: w, height: h } = shape.size;
  const label = (shape.data.label as string) ?? "0";
  return (
    <g transform={`translate(${shape.position.x} ${shape.position.y})`}>
      <SketchPaths shape={shape} paths={sketchRoundedRect(w, h, seedFor(shape.id), { stroke, fill: "#ffffff" })} />
      <SketchPaths shape={shape} paths={sketchLine(w - 20, 0, w - 20, h, seedFor(shape.id, "div"), { stroke, strokeWidth: 0.8 })} />
      <SketchPaths shape={shape} paths={sketchPath(`M ${w - 15} ${h / 2 - 1} L ${w - 10} ${h / 2 - 6} L ${w - 5} ${h / 2 - 1}`, seedFor(shape.id, "up"), { stroke })} />
      <SketchPaths shape={shape} paths={sketchPath(`M ${w - 15} ${h / 2 + 1} L ${w - 10} ${h / 2 + 6} L ${w - 5} ${h / 2 + 1}`, seedFor(shape.id, "down"), { stroke })} />
      <MultilineText text={label} x={10} y={h / 2 + 4} fontSize={12} fill={WIREFRAME_COLORS.text} textAnchor="start" centerVertically={false} />
    </g>
  );
}

function SearchFieldRender({ shape, isSelected }: ShapeRenderProps) {
  const stroke = isSelected ? WIREFRAME_COLORS.strokeSelected : WIREFRAME_COLORS.stroke;
  const { width: w, height: h } = shape.size;
  return (
    <g transform={`translate(${shape.position.x} ${shape.position.y})`}>
      <SketchPaths shape={shape} paths={sketchRoundedRect(w, h, seedFor(shape.id), { stroke, fill: "#ffffff" })} />
      <SketchPaths shape={shape} paths={sketchCircle(16, h / 2 - 1, 9, seedFor(shape.id, "lens"), { stroke })} />
      <SketchPaths shape={shape} paths={sketchLine(20, h / 2 + 3, 24, h / 2 + 7, seedFor(shape.id, "handle"), { stroke })} />
      <MultilineText text="Suchen…" x={30} y={h / 2 + 4} fontSize={11} fill="#999999" textAnchor="start" centerVertically={false} />
    </g>
  );
}

function DatePickerRender({ shape, isSelected }: ShapeRenderProps) {
  const stroke = isSelected ? WIREFRAME_COLORS.strokeSelected : WIREFRAME_COLORS.stroke;
  const { width: w, height: h } = shape.size;
  const label = (shape.data.label as string) ?? "TT.MM.JJJJ";
  const iconX = w - 24;
  return (
    <g transform={`translate(${shape.position.x} ${shape.position.y})`}>
      <SketchPaths shape={shape} paths={sketchRoundedRect(w, h, seedFor(shape.id), { stroke, fill: "#ffffff" })} />
      <g transform={`translate(${iconX} ${h / 2 - 7})`}>
        <SketchPaths shape={shape} paths={sketchRoundedRect(16, 14, seedFor(shape.id, "cal"), { stroke }, 2)} />
        <SketchPaths shape={shape} paths={sketchLine(0, 4.5, 16, 4.5, seedFor(shape.id, "calbar"), { stroke, strokeWidth: 1 })} />
        <SketchPaths shape={shape} paths={sketchLine(4, 0, 4, 3, seedFor(shape.id, "ring1"), { stroke, strokeWidth: 1.4 })} />
        <SketchPaths shape={shape} paths={sketchLine(12, 0, 12, 3, seedFor(shape.id, "ring2"), { stroke, strokeWidth: 1.4 })} />
      </g>
      <MultilineText text={label} x={8} y={h / 2 + 4} fontSize={11.5} fill="#999999" textAnchor="start" centerVertically={false} />
    </g>
  );
}

export function registerInputShapes() {
  const definitions: ShapeDefinition[] = [
    { type: "wireframe.textField", drawingType: "Desktop-Wireframes", category: "Eingabe-Elemente", label: "Textfeld", defaultSize: FIELD_SIZE, ports: RECTANGLE_PORTS, defaultData: { label: "" }, render: TextFieldRender },
    { type: "wireframe.textArea", drawingType: "Desktop-Wireframes", category: "Eingabe-Elemente", label: "Textbereich", defaultSize: { width: 200, height: 90 }, ports: RECTANGLE_PORTS, defaultData: {}, render: TextAreaRender },
    { type: "wireframe.checkbox", drawingType: "Desktop-Wireframes", category: "Eingabe-Elemente", label: "Kontrollkästchen", defaultSize: SMALL_SIZE, ports: RECTANGLE_PORTS, defaultData: { label: "Option", checked: true }, render: CheckboxRender },
    { type: "wireframe.radio", drawingType: "Desktop-Wireframes", category: "Eingabe-Elemente", label: "Optionsfeld", defaultSize: SMALL_SIZE, ports: RECTANGLE_PORTS, defaultData: { label: "Option", checked: true }, render: RadioRender },
    { type: "wireframe.combobox", drawingType: "Desktop-Wireframes", category: "Eingabe-Elemente", label: "Dropdown/Combobox", defaultSize: FIELD_SIZE, ports: RECTANGLE_PORTS, defaultData: { label: "Bitte wählen…" }, render: ComboboxRender },
    { type: "wireframe.slider", drawingType: "Desktop-Wireframes", category: "Eingabe-Elemente", label: "Schieberegler", defaultSize: { width: 160, height: 24 }, ports: RECTANGLE_PORTS, defaultData: { value: 0.5 }, render: SliderRender },
    { type: "wireframe.spinner", drawingType: "Desktop-Wireframes", category: "Eingabe-Elemente", label: "Spinner/Zahlenfeld", defaultSize: { width: 90, height: 30 }, ports: RECTANGLE_PORTS, defaultData: { label: "0" }, render: SpinnerRender },
    { type: "wireframe.searchField", drawingType: "Desktop-Wireframes", category: "Eingabe-Elemente", label: "Suchfeld", defaultSize: FIELD_SIZE, ports: RECTANGLE_PORTS, defaultData: {}, render: SearchFieldRender },
    { type: "wireframe.datePicker", drawingType: "Desktop-Wireframes", category: "Eingabe-Elemente", label: "Datumsauswahl", defaultSize: FIELD_SIZE, ports: RECTANGLE_PORTS, defaultData: {}, render: DatePickerRender },
  ];
  definitions.forEach((def) => ShapeRegistry.register(def));
}
