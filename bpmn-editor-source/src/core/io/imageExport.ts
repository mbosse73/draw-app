import { useCanvasStore } from "../state/canvasStore";
import { getPortPosition } from "../canvas/connectorGeometry";
import { computeConnectorPath } from "../canvas/connectorPath";
import { ConnectorTypeRegistry, DEFAULT_CONNECTOR_STYLE } from "../shapes/ConnectorTypeRegistry";
import { ShapeRegistry } from "../shapes/ShapeRegistry";
import type { ShapeInstance } from "../shapes/types";
import { escapeXml, multilineTextMarkup } from "./staticSvgPrimitives";
import {
  arrowMarkerDescriptors,
  arrowMarkerElementId,
  dashArrayFor,
  resolveConnectorArrowStyle,
  resolveConnectorLineStyle,
} from "../canvas/connectorStyle";

const EXPORT_MARKER_VARIANT = { id: "export", color: "#555555" };
const SHADOW_FILTER_ID = "export-shape-shadow";

/** Deckkraft und Schatten aus dem Stil-Panel - der Live-Renderer legt beides in
 *  CanvasEngine.tsx generisch um JEDE Shape (opacity + CSS drop-shadow), also
 *  muss der Export es hier ebenso generisch tun. Der CSS-Filter wird dabei auf
 *  das SVG-Pendant feDropShadow abgebildet, damit die Datei auch außerhalb des
 *  Browsers (Inkscape, Illustrator) korrekt aussieht. */
function wrapWithVisualStyle(shape: ShapeInstance, markup: string): string {
  const opacity = shape.style?.opacity ?? 1;
  const hasShadow = Boolean(shape.style?.shadow);
  if (opacity >= 1 && !hasShadow) return markup;
  const opacityAttr = opacity < 1 ? ` opacity="${opacity}"` : "";
  const shadowAttr = hasShadow ? ` filter="url(#${SHADOW_FILTER_ID})"` : "";
  return `<g${opacityAttr}${shadowAttr}>${markup}</g>`;
}

function dashArrayForExport(lineStyle: string): string {
  const attr = dashArrayFor(lineStyle as "solid" | "dashed" | "dotted");
  return attr ? ` stroke-dasharray="${attr}"` : "";
}

/** SVG-String-Fragment für alle Pfeilspitzen-Marker, geteilt mit dem Live-Renderer
 *  (ConnectorLayer.tsx) über dieselbe Geometrie-Quelle (connectorStyle.ts). */
function arrowMarkerDefsMarkup(): string {
  return arrowMarkerDescriptors([EXPORT_MARKER_VARIANT])
    .map((m) => {
      const inner =
        m.element === "path"
          ? `<path d="${m.d}" fill="${m.color}" />`
          : `<circle cx="${m.cx}" cy="${m.cy}" r="${m.r}" fill="${m.color}" />`;
      return `<marker id="${m.elementId}" viewBox="${m.viewBox}" refX="${m.refX}" refY="${m.refY}" markerWidth="8" markerHeight="8" orient="auto-start-reverse">${inner}</marker>`;
    })
    .join("\n    ");
}

/** Wendet dieselbe Rotation an, die CanvasEngine.tsx live um den Shape-Mittelpunkt
 *  legt (shape.style.rotation) - muss bei jeder Änderung an der Live-Rotation
 *  hier mitgezogen werden, sonst weicht der Export optisch vom Canvas ab. */
function wrapWithRotation(shape: ShapeInstance, markup: string): string {
  const rotation = shape.style?.rotation;
  if (!rotation) return markup;
  const cx = shape.position.x + shape.size.width / 2;
  const cy = shape.position.y + shape.size.height / 2;
  return `<g transform="rotate(${rotation} ${cx} ${cy})">${markup}</g>`;
}

/**
 * Baut ein eigenständiges SVG-Dokument aus dem aktuellen Diagramm-Inhalt -
 * unabhängig vom Live-Canvas-DOM, damit UI-only-Elemente (Hover-Ports,
 * Auswahl-Highlights, Editing-Overlays) nicht mitexportiert werden.
 *
 * WICHTIG für Wartung: Der Export bildet die Zeichenfläche als reine
 * SVG-String-Templates nach, unabhängig von den React-Komponenten in
 * src/modules/*\/shapes/. Diese Datei kennt dabei nur noch Rahmen, Verbinder
 * und Stil-Hülle; die Darstellung der einzelnen Shapes liefert das jeweilige
 * Modul (`modules/bpmn/io/staticSvg.ts`, `modules/wireframe/io/staticSvg.ts`,
 * registriert über `ShapeRegistry.setStaticSvgRenderer`). Ein neuer Shape-Typ
 * muss dort nachgezogen werden, sonst fällt er auf den generischen
 * Rechteck-Fallback zurück. Absicherung: `npm run check:export` vergleicht
 * Bildschirm und Export für jeden registrierten Typ pixelweise.
 */
export function buildExportSvg(): string {
  const state = useCanvasStore.getState();
  const shapes = Object.values(state.shapes);
  const connectors = Object.values(state.connectors);

  if (shapes.length === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"></svg>`;
  }

  const PADDING = 40;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const shape of shapes) {
    minX = Math.min(minX, shape.position.x);
    minY = Math.min(minY, shape.position.y);
    maxX = Math.max(maxX, shape.position.x + shape.size.width);
    maxY = Math.max(maxY, shape.position.y + shape.size.height);
  }
  minX -= PADDING;
  minY -= PADDING;
  maxX += PADDING;
  maxY += PADDING;
  const width = maxX - minX;
  const height = maxY - minY;

  // Container zuerst (analog zur Bildschirm-Darstellung), damit sie hinter
  // ihren Kindelementen liegen.
  const sortedShapes = [...shapes].sort((a, b) => {
    const aIsContainer = ShapeRegistry.get(a.type)?.isContainer ?? false;
    const bIsContainer = ShapeRegistry.get(b.type)?.isContainer ?? false;
    if (aIsContainer === bIsContainer) return a.zIndex - b.zIndex;
    return aIsContainer ? -1 : 1;
  });

  // Ausgeblendete Kinder (eingeklappte Sub-Prozesse, deren angeheftete
  // Boundary Events) auch im Export überspringen, konsistent zum Bildschirm.
  function isVisible(shape: ShapeInstance): boolean {
    // Manuell ausgeblendete Shapes (Z-05, shape.hidden) exportiert der Renderer
    // ebenso wenig wie der Bildschirm - CanvasEngine.tsx überspringt sie dort
    // beim Rendern. Ohne diese Prüfung tauchen bewusst versteckte Elemente
    // wieder in SVG/PNG auf.
    if (shape.hidden) return false;
    let current: ShapeInstance | undefined = shape;
    const visited = new Set<string>();
    while (current) {
      const nextId: string | undefined = current.parentId ?? current.attachedToId;
      if (!nextId || visited.has(nextId)) break;
      visited.add(nextId);
      const next: ShapeInstance | undefined = state.shapes[nextId];
      if (!next) break;
      const nextDef = ShapeRegistry.get(next.type);
      const isCollapsible = Boolean(nextDef?.collapsedSize && nextDef?.expandedSize);
      if (isCollapsible && !next.data.expanded) return false;
      current = next;
    }
    return true;
  }

  const shapeMarkup = sortedShapes
    .filter(isVisible)
    .map((shape) => wrapWithVisualStyle(shape, wrapWithRotation(shape, renderShapeToStaticSvg(shape))))
    .join("\n");

  const connectorMarkup = connectors
    .map((connector) => {
      const sourceShape = state.shapes[connector.sourceShapeId];
      const targetShape = state.shapes[connector.targetShapeId];
      if (!sourceShape || !targetShape) return "";
      const from = getPortPosition(sourceShape, connector.sourcePortId);
      const to = getPortPosition(targetShape, connector.targetPortId);
      if (!from || !to) return "";
      const excludeIds = new Set([connector.sourceShapeId, connector.targetShapeId]);
      const waypoints = computeConnectorPath(connector, from, to, state.shapes, excludeIds, true);
      const d = waypoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
      const labelLines = connector.label ? connector.label.split("\n") : [];
      const labelOffset = connector.labelOffset ?? { x: 0, y: -6 };
      const midX = (from.x + to.x) / 2 + labelOffset.x;
      const midY = (from.y + to.y) / 2 + labelOffset.y;
      const labelMarkup = labelLines.length
        ? `<text x="${midX}" y="${midY}" text-anchor="middle" font-size="12" fill="#555" font-family="sans-serif">${labelLines
            .map((line, i) => `<tspan x="${midX}" dy="${i === 0 ? 0 : 14}">${escapeXml(line)}</tspan>`)
            .join("")}</text>`
        : "";
      const typeStyle = ConnectorTypeRegistry.get(connector.connectorType) ?? DEFAULT_CONNECTOR_STYLE;
      const lineStyle = resolveConnectorLineStyle(connector, typeStyle);
      const arrows = resolveConnectorArrowStyle(connector, typeStyle);
      const startMarkerId = arrowMarkerElementId(arrows.start, EXPORT_MARKER_VARIANT.id);
      const endMarkerId = arrowMarkerElementId(arrows.end, EXPORT_MARKER_VARIANT.id);
      const startMarkerAttr = startMarkerId ? ` marker-start="url(#${startMarkerId})"` : "";
      const endMarkerAttr = endMarkerId ? ` marker-end="url(#${endMarkerId})"` : "";
      return `<path d="${d}" fill="none" stroke="#555555" stroke-width="1.75"${dashArrayForExport(lineStyle)}${startMarkerAttr}${endMarkerAttr} />${labelMarkup}`;
    })
    .join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${width} ${height}" width="${width}" height="${height}">
  <defs>
    ${arrowMarkerDefsMarkup()}
    <filter id="${SHADOW_FILTER_ID}" x="-25%" y="-25%" width="160%" height="160%">
      <feDropShadow dx="2" dy="3" stdDeviation="2" flood-color="#000000" flood-opacity="0.35" />
    </filter>
  </defs>
  <rect x="${minX}" y="${minY}" width="${width}" height="${height}" fill="#ffffff" />
  ${connectorMarkup}
  ${shapeMarkup}
</svg>`;
}

/**
 * Zeichnet eine Shape für den Export - delegiert an das Modul, dem der
 * Shape-Typ gehört (siehe ShapeRegistry.setStaticSvgRenderer).
 *
 * Der Core weiß hier bewusst NICHT mehr, wie irgendein konkreter Shape-Typ
 * aussieht; er kennt nur noch den generischen Notnagel für Typen, deren Modul
 * keinen Export-Renderer mitbringt. Vorher standen an dieser Stelle sämtliche
 * BPMN- und Wireframe-Darstellungen fest verdrahtet, samt Import aus
 * `modules/wireframe/` - beides Verstöße gegen die Kernregel, dass `core/`
 * kein Modul kennen darf.
 */
function renderShapeToStaticSvg(shape: ShapeInstance): string {
  const render = ShapeRegistry.getStaticSvgRenderer(shape.type);
  if (render) return render(shape);

  const { x, y } = shape.position;
  const { width: w, height: h } = shape.size;
  const label = (shape.data.label as string) ?? "";
  return `<g transform="translate(${x} ${y})">
    <rect width="${w}" height="${h}" rx="6" fill="#ffffff" stroke="#2f3540" stroke-width="1.5" />
    ${label ? multilineTextMarkup(label, w / 2, h / 2 + 6, "#2f3540", 13) : ""}
  </g>`;
}



/** Rendert das Diagramm als PNG (via Offscreen-Canvas) und liefert es als Blob. */
export function exportDiagramAsPng(scale = 2): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const svgString = buildExportSvg();
    const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();

    img.onload = () => {
      const widthMatch = svgString.match(/width="([\d.]+)"/);
      const heightMatch = svgString.match(/height="([\d.]+)"/);
      const width = widthMatch ? parseFloat(widthMatch[1]) : img.width;
      const height = heightMatch ? parseFloat(heightMatch[1]) : img.height;

      const canvas = document.createElement("canvas");
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("Canvas 2D Context nicht verfügbar."));
        return;
      }
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url);
        if (blob) resolve(blob);
        else reject(new Error("PNG-Konvertierung fehlgeschlagen."));
      }, "image/png");
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("SVG konnte nicht als Bild geladen werden."));
    };

    img.src = url;
  });
}
