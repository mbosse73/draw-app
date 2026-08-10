import { useCanvasStore } from "../state/canvasStore";
import { getPortPosition } from "../canvas/connectorGeometry";
import { computeConnectorPath } from "../canvas/connectorPath";
import { ConnectorTypeRegistry, DEFAULT_CONNECTOR_STYLE } from "../shapes/ConnectorTypeRegistry";
import { ShapeRegistry } from "../shapes/ShapeRegistry";
import type { ShapeInstance } from "../shapes/types";

function dashArrayForExport(lineStyle: string): string {
  if (lineStyle === "dashed") return ' stroke-dasharray="8 5"';
  if (lineStyle === "dotted") return ' stroke-dasharray="2 4"';
  return "";
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Baut ein eigenständiges SVG-Dokument aus dem aktuellen Diagramm-Inhalt -
 * unabhängig vom Live-Canvas-DOM, damit UI-only-Elemente (Hover-Ports,
 * Auswahl-Highlights, Editing-Overlays) nicht mitexportiert werden.
 *
 * WICHTIG für Wartung: Dieser Renderer bildet die Zeichenfläche als reine
 * SVG-String-Templates nach, unabhängig von den React-Komponenten in
 * src/modules/*\/shapes/. Wird ein neuer Shape-Typ ergänzt, muss er HIER
 * (renderShapeToStaticSvg) zusätzlich nachgezogen werden, sonst fällt er im
 * Export auf den generischen Rechteck-Fallback zurück. Ein Test dafür:
 * nach dem Hinzufügen eines neuen Shape-Typs ein Diagramm damit exportieren
 * und die SVG-Datei visuell prüfen.
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
    .map((shape) => renderShapeToStaticSvg(shape))
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
      const midX = (from.x + to.x) / 2;
      const midY = (from.y + to.y) / 2 - 6;
      const labelMarkup = labelLines.length
        ? `<text x="${midX}" y="${midY}" text-anchor="middle" font-size="12" fill="#555" font-family="sans-serif">${labelLines
            .map((line, i) => `<tspan x="${midX}" dy="${i === 0 ? 0 : 14}">${escapeXml(line)}</tspan>`)
            .join("")}</text>`
        : "";
      const style = ConnectorTypeRegistry.get(connector.connectorType) ?? DEFAULT_CONNECTOR_STYLE;
      const markerAttr = style.showArrow ? ' marker-end="url(#arrow-head-export)"' : "";
      return `<path d="${d}" fill="none" stroke="#555555" stroke-width="1.75"${dashArrayForExport(style.lineStyle)}${markerAttr} />${labelMarkup}`;
    })
    .join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <marker id="arrow-head-export" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#555555" />
    </marker>
  </defs>
  <rect x="${minX}" y="${minY}" width="${width}" height="${height}" fill="#ffffff" />
  ${connectorMarkup}
  ${shapeMarkup}
</svg>`;
}

function multilineTextMarkup(
  text: string,
  x: number,
  y: number,
  fill: string,
  fontSize: number,
  centerVertically = true
): string {
  const lines = text.split("\n");
  const lineHeight = fontSize * 1.25;
  const startOffset = centerVertically ? -((lines.length - 1) * lineHeight) / 2 : 0;
  const tspans = lines
    .map((line, i) => `<tspan x="${x}" dy="${i === 0 ? startOffset : lineHeight}">${escapeXml(line) || "&#160;"}</tspan>`)
    .join("");
  return `<text x="${x}" y="${y}" text-anchor="middle" font-size="${fontSize}" fill="${fill}" font-family="sans-serif">${tspans}</text>`;
}

/** Trigger-Icon (Timer/Message/Error) für Events, als SVG-Fragment - Pendant zu TriggerIcon in EventShapes.tsx. */
function triggerIconMarkup(trigger: string, r: number): string {
  const stroke = "#626b7a";
  const s = r * 0.85;

  if (trigger === "timer") {
    const marks = [0, 90, 180, 270]
      .map((deg) => {
        const rad = (deg * Math.PI) / 180;
        const x1 = r + Math.sin(rad) * s * 0.55;
        const y1 = r - Math.cos(rad) * s * 0.55;
        const x2 = r + Math.sin(rad) * s * 0.62;
        const y2 = r - Math.cos(rad) * s * 0.62;
        return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" />`;
      })
      .join("");
    return `<g stroke="${stroke}" stroke-width="1.3" fill="none">
      <circle cx="${r}" cy="${r}" r="${s * 0.62}" />
      <line x1="${r}" y1="${r}" x2="${r}" y2="${r - s * 0.4}" />
      <line x1="${r}" y1="${r}" x2="${r + s * 0.28}" y2="${r}" />
      ${marks}
    </g>`;
  }
  if (trigger === "message") {
    const w = s * 0.9;
    const h = s * 0.6;
    const x = r - w / 2;
    const y = r - h / 2;
    return `<g stroke="${stroke}" stroke-width="1.2" fill="none">
      <rect x="${x}" y="${y}" width="${w}" height="${h}" />
      <path d="M ${x} ${y} L ${r} ${y + h * 0.55} L ${x + w} ${y}" />
    </g>`;
  }
  if (trigger === "error") {
    const path = `M ${r - s * 0.35} ${r + s * 0.5} L ${r - s * 0.05} ${r - s * 0.1} L ${r + s * 0.15} ${r + s * 0.15} L ${r + s * 0.4} ${r - s * 0.55}`;
    return `<path d="${path}" stroke="${stroke}" stroke-width="1.6" fill="none" stroke-linejoin="round" stroke-linecap="round" />`;
  }
  return "";
}

/** Task-Icon (User/Service/Manual) für den Export - Pendant zu TaskIcon in TaskShapes.tsx. */
function taskIconMarkup(kind: string): string {
  const stroke = "#626b7a";
  const x = 8;
  const y = 8;
  const size = 16;

  if (kind === "none") {
    return ""; // einfacher Task ohne Symbol
  }

  if (kind === "user") {
    return `<g transform="translate(${x} ${y})" stroke="${stroke}" stroke-width="1.3" fill="none">
      <circle cx="${size / 2}" cy="${size * 0.3}" r="${size * 0.22}" />
      <path d="M ${size * 0.15} ${size} C ${size * 0.15} ${size * 0.6}, ${size * 0.85} ${size * 0.6}, ${size * 0.85} ${size}" />
    </g>`;
  }
  if (kind === "service") {
    const lines = [0, 60, 120, 180, 240, 300]
      .map((angle) => {
        const rad = (angle * Math.PI) / 180;
        const cx = size / 2 + Math.cos(rad) * size * 0.28;
        const cy = size / 2 + Math.sin(rad) * size * 0.28;
        const cx2 = size / 2 + Math.cos(rad) * size * 0.46;
        const cy2 = size / 2 + Math.sin(rad) * size * 0.46;
        return `<line x1="${cx}" y1="${cy}" x2="${cx2}" y2="${cy2}" />`;
      })
      .join("");
    return `<g transform="translate(${x} ${y})" stroke="${stroke}" stroke-width="1.3" fill="none">
      <circle cx="${size / 2}" cy="${size / 2}" r="${size * 0.28}" />
      ${lines}
    </g>`;
  }
  // manual
  return `<g transform="translate(${x} ${y})" stroke="${stroke}" stroke-width="1.3" fill="none">
    <path d="M ${size * 0.2} ${size * 0.9} L ${size * 0.2} ${size * 0.4} C ${size * 0.2} ${size * 0.3}, ${size * 0.35} ${size * 0.3}, ${size * 0.35} ${size * 0.4} L ${size * 0.35} ${size * 0.6} L ${size * 0.5} ${size * 0.6} L ${size * 0.5} ${size * 0.3} C ${size * 0.5} ${size * 0.2}, ${size * 0.65} ${size * 0.2}, ${size * 0.65} ${size * 0.3} L ${size * 0.65} ${size * 0.6} L ${size * 0.85} ${size * 0.65} L ${size * 0.85} ${size * 0.9} Z" />
  </g>`;
}

/** Gateway-Symbol (X/+/O/leer) für den Export - Pendant zu GatewaySymbol in GatewayShapes.tsx. */
function gatewaySymbolMarkup(kind: string, size: number): string {
  const c = size / 2;
  const r = size * 0.22;
  const stroke = "#626b7a";

  if (kind === "exclusive") {
    const d = r * 0.7;
    return `<g stroke="${stroke}" stroke-width="2.2">
      <line x1="${c - d}" y1="${c - d}" x2="${c + d}" y2="${c + d}" />
      <line x1="${c + d}" y1="${c - d}" x2="${c - d}" y2="${c + d}" />
    </g>`;
  }
  if (kind === "parallel") {
    return `<g stroke="${stroke}" stroke-width="2.2">
      <line x1="${c - r}" y1="${c}" x2="${c + r}" y2="${c}" />
      <line x1="${c}" y1="${c - r}" x2="${c}" y2="${c + r}" />
    </g>`;
  }
  if (kind === "inclusive") {
    return `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${stroke}" stroke-width="2.2" />`;
  }
  return ""; // "none": kein Symbol
}

function renderShapeToStaticSvg(shape: ShapeInstance): string {
  const { x, y } = shape.position;
  const { width: w, height: h } = shape.size;
  const label = (shape.data.label as string) ?? "";
  const labelMarkup = label ? multilineTextMarkup(label, w / 2, h / 2 + 5, "#2f3540", 13) : "";

  if (shape.type.startsWith("bpmn.boundaryEvent.")) {
    const r = w / 2;
    const trigger = (shape.data.trigger as string) ?? "timer";
    const isInterrupting = (shape.data.interrupting as boolean) ?? true;
    const dashAttr = isInterrupting ? "" : ' stroke-dasharray="3 2"';
    const labelBelow = label ? multilineTextMarkup(label, r, h + 12, "#2f3540", 11, false) : "";
    return `<g transform="translate(${x} ${y})">
      <circle cx="${r}" cy="${r}" r="${r - 1}" fill="#ffffff" stroke="#454d5a" stroke-width="2"${dashAttr} />
      <circle cx="${r}" cy="${r}" r="${r - 5}" fill="none" stroke="#454d5a" stroke-width="1.3"${dashAttr} />
      ${triggerIconMarkup(trigger, r)}
      ${labelBelow}
    </g>`;
  }

  if (shape.type.startsWith("bpmn.event.")) {
    const r = w / 2;
    const kind = shape.data.eventType as string;
    const trigger = (shape.data.trigger as string) ?? "none";
    const strokeWidth = kind === "end" ? 3.5 : 2;
    const inner =
      kind === "intermediate"
        ? `<circle cx="${r}" cy="${r}" r="${r - strokeWidth - 2.5}" fill="none" stroke="#454d5a" stroke-width="1.5" />`
        : "";
    const labelBelow = label ? multilineTextMarkup(label, r, h + 14, "#2f3540", 12, false) : "";
    return `<g transform="translate(${x} ${y})">
      <circle cx="${r}" cy="${r}" r="${r - strokeWidth / 2}" fill="#ffffff" stroke="#454d5a" stroke-width="${strokeWidth}" />
      ${inner}
      ${triggerIconMarkup(trigger, r)}
      ${labelBelow}
    </g>`;
  }

  if (shape.type === "bpmn.subProcess") {
    const isExpanded = (shape.data.expanded as boolean) ?? false;
    const markerSize = 14;
    const markerCx = w / 2;
    const markerCy = h - markerSize / 2 - 4;
    const labelMarkupSub = isExpanded
      ? multilineTextMarkup(label || "Sub-Prozess", w / 2, 16, "#2f3540", 12, false)
      : multilineTextMarkup(label || "Sub-Prozess", w / 2, h / 2 + 5, "#2f3540", 13);
    const verticalLine = !isExpanded
      ? `<line x1="${markerCx}" y1="${markerCy - 4}" x2="${markerCx}" y2="${markerCy + 4}" stroke="#454d5a" stroke-width="1.4" />`
      : "";
    return `<g transform="translate(${x} ${y})">
      <rect width="${w}" height="${h}" rx="8" fill="${isExpanded ? "#ffffff" : "#f8fafc"}" stroke="#454d5a" stroke-width="1.5" />
      ${labelMarkupSub}
      <rect x="${markerCx - markerSize / 2}" y="${markerCy - markerSize / 2}" width="${markerSize}" height="${markerSize}" rx="2" fill="#ffffff" stroke="#454d5a" stroke-width="1.2" />
      <line x1="${markerCx - 4}" y1="${markerCy}" x2="${markerCx + 4}" y2="${markerCy}" stroke="#454d5a" stroke-width="1.4" />
      ${verticalLine}
    </g>`;
  }

  if (shape.type.startsWith("bpmn.task.")) {
    const kind = (shape.data.taskType as string) ?? "user";
    return `<g transform="translate(${x} ${y})">
      <rect width="${w}" height="${h}" rx="8" fill="#f8fafc" stroke="#454d5a" stroke-width="1.5" />
      ${taskIconMarkup(kind)}
      ${labelMarkup}
    </g>`;
  }

  if (shape.type.startsWith("bpmn.gateway.")) {
    const kind = (shape.data.gatewayType as string) ?? "exclusive";
    const points = `${w / 2},0 ${w},${h / 2} ${w / 2},${h} 0,${h / 2}`;
    const labelBelow = label ? multilineTextMarkup(label, w / 2, h + 16, "#2f3540", 12, false) : "";
    return `<g transform="translate(${x} ${y})">
      <polygon points="${points}" fill="#ffffff" stroke="#454d5a" stroke-width="1.5" />
      ${gatewaySymbolMarkup(kind, Math.min(w, h))}
      ${labelBelow}
    </g>`;
  }

  if (shape.type === "bpmn.dataObject") {
    const fold = w * 0.3;
    const outline = `M 0 0 L ${w - fold} 0 L ${w} ${fold} L ${w} ${h} L 0 ${h} Z`;
    const foldLine = `M ${w - fold} 0 L ${w - fold} ${fold} L ${w} ${fold}`;
    const labelBelow = label ? multilineTextMarkup(label, w / 2, h + 16, "#2f3540", 12, false) : "";
    return `<g transform="translate(${x} ${y})">
      <path d="${outline}" fill="#ffffff" stroke="#454d5a" stroke-width="1.5" />
      <path d="${foldLine}" fill="none" stroke="#454d5a" stroke-width="1.5" />
      ${labelBelow}
    </g>`;
  }

  if (shape.type === "bpmn.pool" || shape.type === "bpmn.lane") {
    const titleBand = 24;
    return `<g transform="translate(${x} ${y})">
      <rect width="${w}" height="${h}" fill="#ffffff" stroke="#454d5a" stroke-width="1" />
      <rect width="${titleBand}" height="${h}" fill="${shape.type === "bpmn.pool" ? "#eef1f8" : "#f6f7fa"}" stroke="#454d5a" stroke-width="1" />
      <g transform="translate(${titleBand / 2} ${h / 2}) rotate(-90)">${multilineTextMarkup(label || (shape.type === "bpmn.pool" ? "Pool" : "Lane"), 0, 0, "#2f3540", shape.type === "bpmn.pool" ? 13 : 12)}</g>
    </g>`;
  }

  if (shape.type === "text.label") {
    const showBorder = (shape.data.showBorder as boolean) ?? false;
    const borderMarkup = showBorder
      ? `<rect width="${w}" height="${h}" fill="#ffffff" stroke="#454d5a" stroke-width="1.5" />`
      : "";
    return `<g transform="translate(${x} ${y})">
      ${borderMarkup}
      ${multilineTextMarkup(label || "Text", w / 2, h / 2 + 5, "#2f3540", 14)}
    </g>`;
  }

  return `<g transform="translate(${x} ${y})">
    <rect width="${w}" height="${h}" rx="6" fill="#ffffff" stroke="#2f3540" stroke-width="1.5" />
    ${labelMarkup}
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
