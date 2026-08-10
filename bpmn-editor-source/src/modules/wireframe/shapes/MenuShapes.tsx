import type { ShapeDefinition, ShapeRenderProps } from "../../../core/shapes/types";
import { ShapeRegistry } from "../../../core/shapes/ShapeRegistry";
import { MultilineText } from "../../../core/canvas/MultilineText";
import { SketchPaths } from "./SketchPaths";
import { sketchRect, sketchLine, seedFor, parseItems } from "./sketch";
import { WIREFRAME_COLORS, STRIP_SIZE, RECTANGLE_PORTS } from "./constants";

function MenuBarRender({ shape, isSelected }: ShapeRenderProps) {
  const stroke = isSelected ? WIREFRAME_COLORS.strokeSelected : WIREFRAME_COLORS.stroke;
  const { width: w, height: h } = shape.size;
  const items = parseItems(shape.data.items, ["Datei", "Bearbeiten", "Ansicht", "Hilfe"]);
  const gap = w / items.length;

  return (
    <g transform={`translate(${shape.position.x} ${shape.position.y})`}>
      <SketchPaths paths={sketchRect(w, h, seedFor(shape.id), { stroke, fill: WIREFRAME_COLORS.fillLight })} />
      {items.map((item, i) => (
        <MultilineText key={i} text={item} x={gap * i + gap / 2} y={h / 2 + 4} fontSize={11} fill={WIREFRAME_COLORS.text} centerVertically={false} />
      ))}
    </g>
  );
}

function DropdownMenuRender({ shape, isSelected }: ShapeRenderProps) {
  const stroke = isSelected ? WIREFRAME_COLORS.strokeSelected : WIREFRAME_COLORS.stroke;
  const { width: w, height: h } = shape.size;
  const items = parseItems(shape.data.items, ["Neu", "Öffnen…", "Speichern", "Beenden"]);
  const rowHeight = h / items.length;

  return (
    <g transform={`translate(${shape.position.x} ${shape.position.y})`}>
      <SketchPaths paths={sketchRect(w, h, seedFor(shape.id), { stroke, fill: "#ffffff" })} />
      {items.map((item, i) => (
        <g key={i}>
          {i > 0 && <SketchPaths paths={sketchLine(4, rowHeight * i, w - 4, rowHeight * i, seedFor(shape.id, `sep${i}`), { strokeWidth: 0.8, stroke })} />}
          <MultilineText text={item} x={12} y={rowHeight * i + rowHeight / 2 + 4} fontSize={11} fill={WIREFRAME_COLORS.text} textAnchor="start" centerVertically={false} />
        </g>
      ))}
    </g>
  );
}

function ToolbarRender({ shape, isSelected }: ShapeRenderProps) {
  const stroke = isSelected ? WIREFRAME_COLORS.strokeSelected : WIREFRAME_COLORS.stroke;
  const { width: w, height: h } = shape.size;
  const buttonCount = Math.max(1, Math.floor((w - 8) / (h + 4)));

  return (
    <g transform={`translate(${shape.position.x} ${shape.position.y})`}>
      <SketchPaths paths={sketchRect(w, h, seedFor(shape.id), { stroke, fill: WIREFRAME_COLORS.fillLight })} />
      {Array.from({ length: buttonCount }).map((_, i) => (
        <g key={i} transform={`translate(${4 + i * h} 4)`}>
          <SketchPaths paths={sketchRect(h - 8, h - 8, seedFor(shape.id, `btn${i}`), { stroke })} />
        </g>
      ))}
    </g>
  );
}

const RIBBON_GROUP_COUNT = 3;

function RibbonRender({ shape, isSelected }: ShapeRenderProps) {
  const stroke = isSelected ? WIREFRAME_COLORS.strokeSelected : WIREFRAME_COLORS.stroke;
  const { width: w, height: h } = shape.size;
  const groupWidth = w / RIBBON_GROUP_COUNT;

  return (
    <g transform={`translate(${shape.position.x} ${shape.position.y})`}>
      <SketchPaths paths={sketchRect(w, h, seedFor(shape.id), { stroke, fill: WIREFRAME_COLORS.fillLight })} />
      {Array.from({ length: RIBBON_GROUP_COUNT }).map((_, g) => (
        <g key={g} transform={`translate(${g * groupWidth + 6} 6)`}>
          <SketchPaths paths={sketchRect(20, 20, seedFor(shape.id, `ic${g}a`), { stroke })} />
          <SketchPaths paths={sketchRect(20, 20, seedFor(shape.id, `ic${g}b`), { stroke })} />
          {g > 0 && <SketchPaths paths={sketchLine(-6, 0, -6, h - 12, seedFor(shape.id, `sep${g}`), { stroke, strokeWidth: 0.8 })} />}
        </g>
      ))}
    </g>
  );
}

function BreadcrumbRender({ shape, isSelected }: ShapeRenderProps) {
  const stroke = isSelected ? WIREFRAME_COLORS.strokeSelected : WIREFRAME_COLORS.stroke;
  const { height: h } = shape.size;
  const items = parseItems(shape.data.items, ["Start", "Projekte", "Jahresbericht"]);
  let cursorX = 0;
  const segments = items.map((item, i) => {
    const segX = cursorX;
    cursorX += item.length * 6.5 + 20;
    return { item, x: segX, isLast: i === items.length - 1 };
  });

  return (
    <g transform={`translate(${shape.position.x} ${shape.position.y})`}>
      {segments.map((seg, i) => (
        <g key={i}>
          <MultilineText text={seg.item} x={seg.x} y={h / 2 + 4} fontSize={11.5} fill={seg.isLast ? stroke : WIREFRAME_COLORS.stroke} textAnchor="start" centerVertically={false} />
          {!seg.isLast && <MultilineText text="›" x={seg.x + seg.item.length * 6.5 + 8} y={h / 2 + 4} fontSize={12} fill={WIREFRAME_COLORS.stroke} textAnchor="start" centerVertically={false} />}
        </g>
      ))}
    </g>
  );
}

export function registerMenuShapes() {
  const definitions: ShapeDefinition[] = [
    {
      type: "wireframe.menuBar",
      drawingType: "Desktop-Wireframes",
      category: "Menüs & Symbolleisten",
      label: "Menüleiste",
      defaultSize: STRIP_SIZE,
      ports: RECTANGLE_PORTS,
      defaultData: { items: "Datei\nBearbeiten\nAnsicht\nHilfe" },
      isContainer: true,
      render: MenuBarRender,
    },
    {
      type: "wireframe.dropdownMenu",
      drawingType: "Desktop-Wireframes",
      category: "Menüs & Symbolleisten",
      label: "Kontextmenü",
      defaultSize: { width: 150, height: 110 },
      ports: RECTANGLE_PORTS,
      defaultData: { items: "Neu\nÖffnen…\nSpeichern\nBeenden" },
      render: DropdownMenuRender,
    },
    {
      type: "wireframe.toolbar",
      drawingType: "Desktop-Wireframes",
      category: "Menüs & Symbolleisten",
      label: "Symbolleiste",
      defaultSize: { width: 260, height: 34 },
      ports: RECTANGLE_PORTS,
      defaultData: {},
      isContainer: true,
      render: ToolbarRender,
    },
    {
      type: "wireframe.ribbon",
      drawingType: "Desktop-Wireframes",
      category: "Menüs & Symbolleisten",
      label: "Ribbon",
      defaultSize: { width: 360, height: 70 },
      ports: RECTANGLE_PORTS,
      defaultData: {},
      isContainer: true,
      render: RibbonRender,
    },
    {
      type: "wireframe.breadcrumb",
      drawingType: "Desktop-Wireframes",
      category: "Menüs & Symbolleisten",
      label: "Breadcrumb",
      defaultSize: { width: 240, height: 24 },
      ports: RECTANGLE_PORTS,
      defaultData: { items: "Start\nProjekte\nJahresbericht" },
      render: BreadcrumbRender,
    },
  ];
  definitions.forEach((def) => ShapeRegistry.register(def));
}
