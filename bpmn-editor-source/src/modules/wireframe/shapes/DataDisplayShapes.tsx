import type { ShapeDefinition, ShapeRenderProps } from "../../../core/shapes/types";
import { ShapeRegistry } from "../../../core/shapes/ShapeRegistry";
import { MultilineText } from "../../../core/canvas/MultilineText";
import { SketchPaths } from "./SketchPaths";
import { sketchRect, sketchRoundedRect, sketchLine, sketchCircle, sketchSparkle, seedFor, parseItems } from "./sketch";
import { WIREFRAME_COLORS, LIST_SIZE, RECTANGLE_PORTS } from "./constants";

function ListRender({ shape, isSelected }: ShapeRenderProps) {
  const stroke = isSelected ? WIREFRAME_COLORS.strokeSelected : WIREFRAME_COLORS.stroke;
  const { width: w, height: h } = shape.size;
  const items = parseItems(shape.data.items, ["Eintrag 1", "Eintrag 2", "Eintrag 3", "Eintrag 4"]);
  const rowHeight = h / items.length;
  return (
    <g transform={`translate(${shape.position.x} ${shape.position.y})`}>
      <SketchPaths paths={sketchRect(w, h, seedFor(shape.id), { stroke, fill: "#ffffff" })} />
      {items.map((item, i) => (
        <g key={i}>
          {i > 0 && <SketchPaths paths={sketchLine(4, rowHeight * i, w - 4, rowHeight * i, seedFor(shape.id, `sep${i}`), { stroke, strokeWidth: 0.8 })} />}
          <MultilineText text={item} x={10} y={rowHeight * i + rowHeight / 2 + 4} fontSize={11.5} fill={WIREFRAME_COLORS.text} textAnchor="start" centerVertically={false} />
        </g>
      ))}
    </g>
  );
}

function TableRender({ shape, isSelected }: ShapeRenderProps) {
  const stroke = isSelected ? WIREFRAME_COLORS.strokeSelected : WIREFRAME_COLORS.stroke;
  const { width: w, height: h } = shape.size;
  const columns = parseItems(shape.data.columns, ["Name", "Datum", "Status"]);
  const rows = parseItems(shape.data.items, ["Zeile 1", "Zeile 2", "Zeile 3"]);
  const headerHeight = 24;
  const rowHeight = (h - headerHeight) / rows.length;
  const colWidth = w / columns.length;

  return (
    <g transform={`translate(${shape.position.x} ${shape.position.y})`}>
      <SketchPaths paths={sketchRect(w, h, seedFor(shape.id), { stroke, fill: "#ffffff" })} />
      <SketchPaths paths={sketchLine(0, headerHeight, w, headerHeight, seedFor(shape.id, "headersep"), { stroke, strokeWidth: 1.4 })} />
      {columns.map((col, i) => (
        <g key={i}>
          <MultilineText text={col} x={colWidth * i + 8} y={headerHeight / 2 + 4} fontSize={11} fill={WIREFRAME_COLORS.text} textAnchor="start" centerVertically={false} />
          {i > 0 && <SketchPaths paths={sketchLine(colWidth * i, 0, colWidth * i, h, seedFor(shape.id, `col${i}`), { stroke, strokeWidth: 0.8 })} />}
        </g>
      ))}
      {rows.map((row, i) => (
        <g key={i}>
          {i > 0 && <SketchPaths paths={sketchLine(0, headerHeight + rowHeight * i, w, headerHeight + rowHeight * i, seedFor(shape.id, `row${i}`), { stroke, strokeWidth: 0.6 })} />}
          <MultilineText text={row} x={8} y={headerHeight + rowHeight * i + rowHeight / 2 + 4} fontSize={10.5} fill={WIREFRAME_COLORS.text} textAnchor="start" centerVertically={false} />
        </g>
      ))}
    </g>
  );
}

/** Zeilen mit führenden Leerzeichen gelten als eingerückt (eine Ebene pro 2 Leerzeichen) - einfache Konvention für die Baumansicht ohne eigenes Datenmodell. */
function TreeRender({ shape, isSelected }: ShapeRenderProps) {
  const stroke = isSelected ? WIREFRAME_COLORS.strokeSelected : WIREFRAME_COLORS.stroke;
  const { width: w, height: h } = shape.size;
  const rawRows = parseItems(shape.data.items, ["Projekte", "  Berichte", "  Archiv", "Vorlagen"]);
  const rowHeight = h / rawRows.length;

  return (
    <g transform={`translate(${shape.position.x} ${shape.position.y})`}>
      <SketchPaths paths={sketchRect(w, h, seedFor(shape.id), { stroke, fill: "#ffffff" })} />
      {rawRows.map((row, i) => {
        const indentLevel = (row.match(/^ */)?.[0].length ?? 0) / 2;
        const text = row.trimStart();
        const x = 8 + indentLevel * 14;
        return (
          <g key={i}>
            {indentLevel === 0 && (
              <g transform={`translate(8 ${rowHeight * i + rowHeight / 2 - 4.5})`}>
                <SketchPaths paths={sketchRect(9, 9, seedFor(shape.id, `box${i}`), { stroke })} />
              </g>
            )}
            <MultilineText text={text} x={x + (indentLevel === 0 ? 14 : 0)} y={rowHeight * i + rowHeight / 2 + 4} fontSize={11} fill={WIREFRAME_COLORS.text} textAnchor="start" centerVertically={false} />
          </g>
        );
      })}
    </g>
  );
}

function ProgressBarRender({ shape, isSelected }: ShapeRenderProps) {
  const stroke = isSelected ? WIREFRAME_COLORS.strokeSelected : WIREFRAME_COLORS.stroke;
  const { width: w, height: h } = shape.size;
  const progress = Math.min(1, Math.max(0, (shape.data.progress as number) ?? 0.6));
  return (
    <g transform={`translate(${shape.position.x} ${shape.position.y})`}>
      <SketchPaths paths={sketchRect(w, h, seedFor(shape.id), { stroke, fill: "#ffffff" })} />
      <SketchPaths paths={sketchRect(w * progress, h, seedFor(shape.id, "fill"), { stroke, fill: WIREFRAME_COLORS.accentFill, fillStyle: "solid" })} />
    </g>
  );
}

function ImagePlaceholderRender({ shape, isSelected }: ShapeRenderProps) {
  const stroke = isSelected ? WIREFRAME_COLORS.strokeSelected : WIREFRAME_COLORS.stroke;
  const { width: w, height: h } = shape.size;
  return (
    <g transform={`translate(${shape.position.x} ${shape.position.y})`}>
      <SketchPaths paths={sketchRoundedRect(w, h, seedFor(shape.id), { stroke, fill: "#ffffff" }, 4)} />
      <SketchPaths paths={sketchCircle(w * 0.64, h * 0.2, Math.min(w, h) * 0.14, seedFor(shape.id, "sun"), { stroke })} />
      <SketchPaths paths={sketchLine(w * 0.1, h * 0.75, w * 0.4, h * 0.4, seedFor(shape.id, "m1"), { stroke })} />
      <SketchPaths paths={sketchLine(w * 0.4, h * 0.4, w * 0.62, h * 0.62, seedFor(shape.id, "m2"), { stroke })} />
      <SketchPaths paths={sketchLine(w * 0.62, h * 0.62, w * 0.85, h * 0.3, seedFor(shape.id, "m3"), { stroke })} />
      <SketchPaths paths={sketchLine(w * 0.85, h * 0.3, w * 0.92, h * 0.75, seedFor(shape.id, "m4"), { stroke })} />
      <SketchPaths paths={sketchLine(w * 0.08, h * 0.75, w * 0.92, h * 0.75, seedFor(shape.id, "ground"), { stroke })} />
    </g>
  );
}

function CardRender({ shape, isSelected }: ShapeRenderProps) {
  const stroke = isSelected ? WIREFRAME_COLORS.strokeSelected : WIREFRAME_COLORS.stroke;
  const { width: w, height: h } = shape.size;
  const imgHeight = h * 0.55;
  const label = (shape.data.label as string) ?? "Titel";
  return (
    <g transform={`translate(${shape.position.x} ${shape.position.y})`}>
      <SketchPaths paths={sketchRoundedRect(w, h, seedFor(shape.id), { stroke, fill: "#ffffff" })} />
      <g transform="translate(8 8)">
        <SketchPaths paths={sketchRoundedRect(w - 16, imgHeight - 10, seedFor(shape.id, "img"), { stroke }, 3)} />
      </g>
      <MultilineText text={label} x={8} y={imgHeight + 18} fontSize={11.5} fill={WIREFRAME_COLORS.text} textAnchor="start" centerVertically={false} />
      <SketchPaths paths={sketchLine(8, imgHeight + 28, w - 24, imgHeight + 28, seedFor(shape.id, "l1"), { stroke: WIREFRAME_COLORS.accentFill, strokeWidth: 2 })} />
    </g>
  );
}

const CHART_BAR_HEIGHTS = [0.5, 0.85, 0.35, 0.7, 0.55];

function ChartRender({ shape, isSelected }: ShapeRenderProps) {
  const stroke = isSelected ? WIREFRAME_COLORS.strokeSelected : WIREFRAME_COLORS.stroke;
  const { width: w, height: h } = shape.size;
  const padding = 8;
  const innerW = w - padding * 2;
  const innerH = h - padding * 2;
  const barGap = 6;
  const barW = (innerW - barGap * (CHART_BAR_HEIGHTS.length - 1)) / CHART_BAR_HEIGHTS.length;

  return (
    <g transform={`translate(${shape.position.x} ${shape.position.y})`}>
      <SketchPaths paths={sketchRect(w, h, seedFor(shape.id), { stroke, fill: "#ffffff" })} />
      <SketchPaths paths={sketchLine(padding, h - padding, w - padding, h - padding, seedFor(shape.id, "axis"), { stroke })} />
      {CHART_BAR_HEIGHTS.map((ratio, i) => {
        const barH = innerH * ratio;
        const x = padding + i * (barW + barGap);
        const y = h - padding - barH;
        return (
          <g key={i} transform={`translate(${x} ${y})`}>
            <SketchPaths paths={sketchRect(barW, barH, seedFor(shape.id, `bar${i}`), { stroke, fill: WIREFRAME_COLORS.accentFill, fillStyle: "solid" })} />
          </g>
        );
      })}
    </g>
  );
}

/** Generischer Icon-Platzhalter: ein Stern/Funken statt eines leeren Kreises
 *  (der zuvor mit fast jedem anderen runden Element verwechselbar war) -
 *  signalisiert eindeutig "hier steht ein Icon", ohne ein bestimmtes zu erfinden. */
function IconRender({ shape, isSelected }: ShapeRenderProps) {
  const stroke = isSelected ? WIREFRAME_COLORS.strokeSelected : WIREFRAME_COLORS.stroke;
  const { width: w, height: h } = shape.size;
  const r = Math.min(w, h) * 0.42;
  return (
    <g transform={`translate(${shape.position.x} ${shape.position.y})`}>
      <SketchPaths paths={sketchSparkle(w / 2, h / 2, r, seedFor(shape.id), { stroke, fill: WIREFRAME_COLORS.fillLight, fillStyle: "solid" })} />
    </g>
  );
}

export function registerDataDisplayShapes() {
  const definitions: ShapeDefinition[] = [
    { type: "wireframe.list", drawingType: "Desktop-Wireframes", category: "Datenanzeige", label: "Liste/Listbox", defaultSize: LIST_SIZE, ports: RECTANGLE_PORTS, defaultData: { items: "Eintrag 1\nEintrag 2\nEintrag 3\nEintrag 4" }, render: ListRender },
    { type: "wireframe.table", drawingType: "Desktop-Wireframes", category: "Datenanzeige", label: "Tabelle/Datengrid", defaultSize: { width: 300, height: 160 }, ports: RECTANGLE_PORTS, defaultData: { columns: "Name\nDatum\nStatus", items: "Zeile 1\nZeile 2\nZeile 3" }, render: TableRender },
    { type: "wireframe.tree", drawingType: "Desktop-Wireframes", category: "Datenanzeige", label: "Baumansicht", defaultSize: { width: 180, height: 160 }, ports: RECTANGLE_PORTS, defaultData: { items: "Projekte\n  Berichte\n  Archiv\nVorlagen\nPapierkorb" }, render: TreeRender },
    { type: "wireframe.progressBar", drawingType: "Desktop-Wireframes", category: "Datenanzeige", label: "Fortschrittsbalken", defaultSize: { width: 200, height: 16 }, ports: RECTANGLE_PORTS, defaultData: { progress: 0.6 }, render: ProgressBarRender },
    { type: "wireframe.imagePlaceholder", drawingType: "Desktop-Wireframes", category: "Datenanzeige", label: "Bildplatzhalter", defaultSize: { width: 160, height: 120 }, ports: RECTANGLE_PORTS, defaultData: {}, render: ImagePlaceholderRender },
    { type: "wireframe.card", drawingType: "Desktop-Wireframes", category: "Datenanzeige", label: "Karte", defaultSize: { width: 180, height: 160 }, ports: RECTANGLE_PORTS, defaultData: { label: "Titel" }, render: CardRender },
    { type: "wireframe.chart", drawingType: "Desktop-Wireframes", category: "Datenanzeige", label: "Diagramm", defaultSize: { width: 200, height: 130 }, ports: RECTANGLE_PORTS, defaultData: {}, render: ChartRender },
    { type: "wireframe.icon", drawingType: "Desktop-Wireframes", category: "Datenanzeige", label: "Icon", defaultSize: { width: 24, height: 24 }, ports: RECTANGLE_PORTS, defaultData: {}, render: IconRender },
  ];
  definitions.forEach((def) => ShapeRegistry.register(def));
}
