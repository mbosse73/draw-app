import type { ShapeDefinition, ShapeRenderProps } from "../../../core/shapes/types";
import { ShapeRegistry } from "../../../core/shapes/ShapeRegistry";
import { MultilineText } from "../../../core/canvas/MultilineText";
import { SketchPaths } from "./SketchPaths";
import { sketchRect, sketchRoundedRect, sketchLine, sketchCircle, seedFor } from "./sketch";
import { WIREFRAME_COLORS, WINDOW_SIZE, DIALOG_SIZE, RECTANGLE_PORTS } from "./constants";

const TITLE_BAR_HEIGHT = 26;

function WindowChrome({ shape, isSelected, titleBarFill }: ShapeRenderProps & { titleBarFill: string }) {
  const stroke = isSelected ? WIREFRAME_COLORS.strokeSelected : WIREFRAME_COLORS.stroke;
  const { width: w, height: h } = shape.size;
  const label = (shape.data.label as string) ?? "Fenster";
  const seed = seedFor(shape.id);

  return (
    <g transform={`translate(${shape.position.x} ${shape.position.y})`}>
      <SketchPaths paths={sketchRoundedRect(w, h, seed, { stroke, fill: "#ffffff" }, 5)} />
      <SketchPaths paths={sketchRect(w, TITLE_BAR_HEIGHT, seedFor(shape.id, "titlebar"), { stroke, fill: titleBarFill })} />
      {/* System-Menü-Kreis links */}
      <SketchPaths paths={sketchCircle(16, TITLE_BAR_HEIGHT / 2, 8, seedFor(shape.id, "sysicon"), { stroke })} />
      <MultilineText text={label} x={w / 2 + 8} y={TITLE_BAR_HEIGHT / 2 + 4} fontSize={12} fill={WIREFRAME_COLORS.text} centerVertically={false} />
      {/* Schließen-X rechts */}
      <SketchPaths paths={sketchLine(w - 20, 8, w - 8, TITLE_BAR_HEIGHT - 8, seedFor(shape.id, "closeA"), { stroke })} />
      <SketchPaths paths={sketchLine(w - 8, 8, w - 20, TITLE_BAR_HEIGHT - 8, seedFor(shape.id, "closeB"), { stroke })} />
    </g>
  );
}

function WindowRender(props: ShapeRenderProps) {
  return <WindowChrome {...props} titleBarFill="#eef0f2" />;
}

function DialogRender(props: ShapeRenderProps) {
  return <WindowChrome {...props} titleBarFill="#e6e6e6" />;
}

/** Vorgefertigte Meldungsfenster-Komposition (Balsamiqs "Alert Dialog") -
 *  anders als Fenster/Dialog bewusst KEIN Container: repräsentiert eine
 *  fertige System-Meldung (Icon + Text + OK-Button), nicht eine Fläche zum
 *  freien Zusammenstellen eigener Inhalte. */
function MessageBoxRender({ shape, isSelected }: ShapeRenderProps) {
  const stroke = isSelected ? WIREFRAME_COLORS.strokeSelected : WIREFRAME_COLORS.stroke;
  const { width: w, height: h } = shape.size;
  const label = (shape.data.label as string) ?? "Möchten Sie fortfahren?";
  const seed = seedFor(shape.id);
  const btnW = 70;
  const btnH = 26;

  return (
    <g transform={`translate(${shape.position.x} ${shape.position.y})`}>
      <SketchPaths paths={sketchRoundedRect(w, h, seed, { stroke, fill: "#ffffff" }, 5)} />
      <SketchPaths paths={sketchCircle(24, 30, 24, seedFor(shape.id, "icon"), { stroke })} />
      <MultilineText text="!" x={24} y={38} fontSize={18} fill={WIREFRAME_COLORS.text} />
      <MultilineText text={label} x={w / 2 + 16} y={34} fontSize={12} fill={WIREFRAME_COLORS.text} />
      <g transform={`translate(${w - btnW - 12} ${h - btnH - 10})`}>
        <SketchPaths paths={sketchRoundedRect(btnW, btnH, seedFor(shape.id, "ok"), { stroke }, 4)} />
        <MultilineText text="OK" x={btnW / 2} y={btnH / 2 + 4} fontSize={11.5} fill={WIREFRAME_COLORS.text} />
      </g>
    </g>
  );
}

export function registerWindowShapes() {
  const definitions: ShapeDefinition[] = [
    {
      type: "wireframe.window",
      drawingType: "Desktop-Wireframes",
      category: "Fenster & Struktur",
      label: "Anwendungsfenster",
      defaultSize: WINDOW_SIZE,
      ports: RECTANGLE_PORTS,
      defaultData: { label: "Anwendungsfenster" },
      isContainer: true,
      render: WindowRender,
    },
    {
      type: "wireframe.dialog",
      drawingType: "Desktop-Wireframes",
      category: "Fenster & Struktur",
      label: "Dialogfenster",
      defaultSize: DIALOG_SIZE,
      ports: RECTANGLE_PORTS,
      defaultData: { label: "Dialog" },
      isContainer: true,
      render: DialogRender,
    },
    {
      type: "wireframe.messageBox",
      drawingType: "Desktop-Wireframes",
      category: "Fenster & Struktur",
      label: "Meldungsfenster",
      defaultSize: { width: 260, height: 100 },
      ports: RECTANGLE_PORTS,
      defaultData: { label: "Möchten Sie fortfahren?" },
      render: MessageBoxRender,
    },
  ];
  definitions.forEach((def) => ShapeRegistry.register(def));
}
