import type { ShapeDefinition, ShapeRenderProps } from "../../../core/shapes/types";
import { ShapeRegistry } from "../../../core/shapes/ShapeRegistry";
import { MultilineText } from "../../../core/canvas/MultilineText";
import { SketchPaths } from "./SketchPaths";
import { sketchRect, sketchRoundedRect, sketchLine, seedFor, parseItems } from "./sketch";
import { WIREFRAME_COLORS, PANEL_SIZE, STRIP_SIZE, RECTANGLE_PORTS } from "./constants";

function PanelRender({ shape, isSelected }: ShapeRenderProps) {
  const stroke = isSelected ? WIREFRAME_COLORS.strokeSelected : WIREFRAME_COLORS.stroke;
  const { width: w, height: h } = shape.size;
  const label = (shape.data.label as string) ?? "";
  const seed = seedFor(shape.id);

  return (
    <g transform={`translate(${shape.position.x} ${shape.position.y})`}>
      <SketchPaths paths={sketchRoundedRect(w, h, seed, { stroke }, 4)} />
      {label && <MultilineText text={label} x={10} y={14} fontSize={11.5} fill={WIREFRAME_COLORS.text} textAnchor="start" centerVertically={false} />}
    </g>
  );
}

const TAB_WIDTH = 70;
const TAB_HEIGHT = 22;

function TabContainerRender({ shape, isSelected }: ShapeRenderProps) {
  const stroke = isSelected ? WIREFRAME_COLORS.strokeSelected : WIREFRAME_COLORS.stroke;
  const { width: w, height: h } = shape.size;
  const tabs = parseItems(shape.data.items, ["Übersicht", "Details", "Verlauf"]);

  return (
    <g transform={`translate(${shape.position.x} ${shape.position.y})`}>
      <SketchPaths paths={sketchRect(w, h - TAB_HEIGHT, seedFor(shape.id, "body"), { stroke })} />
      {tabs.map((tab, i) => (
        <g key={i} transform={`translate(${i * TAB_WIDTH} 0)`}>
          <SketchPaths paths={sketchRect(TAB_WIDTH, TAB_HEIGHT, seedFor(shape.id, `tab${i}`), { stroke })} />
          <MultilineText text={tab} x={TAB_WIDTH / 2} y={TAB_HEIGHT / 2 + 4} fontSize={10.5} fill={WIREFRAME_COLORS.text} centerVertically={false} />
        </g>
      ))}
    </g>
  );
}

function SplitterRender({ shape, isSelected }: ShapeRenderProps) {
  const stroke = isSelected ? WIREFRAME_COLORS.strokeSelected : WIREFRAME_COLORS.stroke;
  const { width: w, height: h } = shape.size;
  return (
    <g transform={`translate(${shape.position.x} ${shape.position.y})`}>
      <SketchPaths paths={sketchLine(w / 2, 0, w / 2, h, seedFor(shape.id), { stroke, strokeWidth: 1.6 })} />
    </g>
  );
}

function StatusBarRender({ shape, isSelected }: ShapeRenderProps) {
  const stroke = isSelected ? WIREFRAME_COLORS.strokeSelected : WIREFRAME_COLORS.stroke;
  const { width: w, height: h } = shape.size;
  const label = (shape.data.label as string) ?? "Bereit";
  return (
    <g transform={`translate(${shape.position.x} ${shape.position.y})`}>
      <SketchPaths paths={sketchRect(w, h, seedFor(shape.id), { stroke, fill: WIREFRAME_COLORS.fillLight })} />
      <MultilineText text={label} x={10} y={h / 2 + 4} fontSize={10.5} fill={WIREFRAME_COLORS.text} textAnchor="start" centerVertically={false} />
    </g>
  );
}

function ScrollbarRender({ shape, isSelected }: ShapeRenderProps) {
  const stroke = isSelected ? WIREFRAME_COLORS.strokeSelected : WIREFRAME_COLORS.stroke;
  const { width: w, height: h } = shape.size;
  const isVertical = h >= w;
  const thumbLength = (isVertical ? h : w) * 0.4;
  return (
    <g transform={`translate(${shape.position.x} ${shape.position.y})`}>
      <SketchPaths paths={sketchRect(w, h, seedFor(shape.id), { stroke, fill: WIREFRAME_COLORS.fillLight })} />
      {isVertical ? (
        <SketchPaths paths={sketchRect(w - 4, thumbLength, seedFor(shape.id, "thumb"), { stroke, fill: WIREFRAME_COLORS.accentFill, fillStyle: "solid" })} />
      ) : (
        <SketchPaths paths={sketchRect(thumbLength, h - 4, seedFor(shape.id, "thumb"), { stroke, fill: WIREFRAME_COLORS.accentFill, fillStyle: "solid" })} />
      )}
    </g>
  );
}

const ACCORDION_HEADER_H = 24;

function AccordionRender({ shape, isSelected }: ShapeRenderProps) {
  const stroke = isSelected ? WIREFRAME_COLORS.strokeSelected : WIREFRAME_COLORS.stroke;
  const { width: w, height: h } = shape.size;
  const sections = parseItems(shape.data.items, ["Allgemein", "Erweitert", "Info"]);
  const bodyHeight = Math.max(0, h - sections.length * ACCORDION_HEADER_H);

  let cursorY = 0;
  const rows: { y: number; section: string; expanded: boolean }[] = sections.map((section, i) => {
    const row = { y: cursorY, section, expanded: i === 0 };
    cursorY += ACCORDION_HEADER_H + (i === 0 ? bodyHeight : 0);
    return row;
  });

  return (
    <g transform={`translate(${shape.position.x} ${shape.position.y})`}>
      {rows.map((row, i) => (
        <g key={i} transform={`translate(0 ${row.y})`}>
          <SketchPaths paths={sketchRect(w, ACCORDION_HEADER_H, seedFor(shape.id, `hdr${i}`), { stroke, fill: WIREFRAME_COLORS.fillLight })} />
          <MultilineText text={`${row.expanded ? "▾" : "▸"} ${row.section}`} x={10} y={ACCORDION_HEADER_H / 2 + 4} fontSize={11} fill={WIREFRAME_COLORS.text} textAnchor="start" centerVertically={false} />
          {row.expanded && (
            <g transform={`translate(0 ${ACCORDION_HEADER_H})`}>
              <SketchPaths paths={sketchRect(w, bodyHeight, seedFor(shape.id, "body"), { stroke })} />
            </g>
          )}
        </g>
      ))}
    </g>
  );
}

export function registerContainerShapes() {
  const definitions: ShapeDefinition[] = [
    {
      type: "wireframe.panel",
      drawingType: "Desktop-Wireframes",
      category: "Fenster & Struktur",
      label: "Gruppenrahmen",
      defaultSize: PANEL_SIZE,
      ports: RECTANGLE_PORTS,
      defaultData: { label: "Gruppe" },
      isContainer: true,
      render: PanelRender,
    },
    {
      type: "wireframe.tabContainer",
      drawingType: "Desktop-Wireframes",
      category: "Fenster & Struktur",
      label: "Tab-Container",
      defaultSize: { width: 240, height: 160 },
      ports: RECTANGLE_PORTS,
      defaultData: { items: "Übersicht\nDetails\nVerlauf" },
      isContainer: true,
      render: TabContainerRender,
    },
    {
      type: "wireframe.splitter",
      drawingType: "Desktop-Wireframes",
      category: "Fenster & Struktur",
      label: "Trennlinie",
      defaultSize: { width: 20, height: 140 },
      ports: RECTANGLE_PORTS,
      defaultData: {},
      render: SplitterRender,
    },
    {
      type: "wireframe.statusBar",
      drawingType: "Desktop-Wireframes",
      category: "Fenster & Struktur",
      label: "Statusleiste",
      defaultSize: STRIP_SIZE,
      ports: RECTANGLE_PORTS,
      defaultData: { label: "Bereit" },
      render: StatusBarRender,
    },
    {
      type: "wireframe.scrollbar",
      drawingType: "Desktop-Wireframes",
      category: "Fenster & Struktur",
      label: "Scrollbar",
      defaultSize: { width: 16, height: 140 },
      ports: RECTANGLE_PORTS,
      defaultData: {},
      render: ScrollbarRender,
    },
    {
      type: "wireframe.accordion",
      drawingType: "Desktop-Wireframes",
      category: "Fenster & Struktur",
      label: "Accordion",
      defaultSize: { width: 220, height: 160 },
      ports: RECTANGLE_PORTS,
      defaultData: { items: "Allgemein\nErweitert\nInfo" },
      isContainer: true,
      render: AccordionRender,
    },
  ];
  definitions.forEach((def) => ShapeRegistry.register(def));
}
