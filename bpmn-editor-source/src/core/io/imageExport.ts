import { useCanvasStore } from "../state/canvasStore";
import { getPortPosition } from "../canvas/connectorGeometry";
import { computeConnectorPath } from "../canvas/connectorPath";
import { ConnectorTypeRegistry, DEFAULT_CONNECTOR_STYLE } from "../shapes/ConnectorTypeRegistry";
import { ShapeRegistry } from "../shapes/ShapeRegistry";
import type { ShapeInstance } from "../shapes/types";
import {
  arrowMarkerDescriptors,
  arrowMarkerElementId,
  dashArrayFor,
  resolveConnectorArrowStyle,
  resolveConnectorLineStyle,
} from "../canvas/connectorStyle";
import { sketchRect, sketchRoundedRect, sketchLine, sketchCircle, sketchPath, sketchSparkle, sketchPathsToSvgString, seedFor, parseItems } from "../../modules/wireframe/shapes/sketch";

const EXPORT_MARKER_VARIANT = { id: "export", color: "#555555" };

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
    .map((shape) => wrapWithRotation(shape, renderShapeToStaticSvg(shape)))
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

/**
 * Export-Pendant zu modules/wireframe/shapes/*.tsx. Nutzt dieselben sketch.ts-
 * Primitiven wie der Live-Renderer (gleicher Seed -> exakt gleiche
 * "Wackligkeit"), damit Bildschirm und Export nie auseinanderdriften - genau
 * der Punkt, an dem BPMN-Shapes früher schon einmal auseinandergelaufen sind
 * (siehe technische Doku, Abschnitt 4.5/5). Nur die Zusammensetzung
 * (Reihenfolge/Position der Teile) ist zwangsläufig zweimal vorhanden, da JSX
 * und SVG-String zwei unterschiedliche Zielformate sind.
 */
function renderWireframeShapeToStaticSvg(shape: ShapeInstance): string {
  const { width: w, height: h } = shape.size;
  const kind = shape.type.slice("wireframe.".length);
  const stroke = "#4a4a4a";
  const label = (shape.data.label as string) ?? "";
  const seed = seedFor(shape.id);
  const paths = (p: ReturnType<typeof sketchRect>) => sketchPathsToSvgString(p);

  if (kind === "window" || kind === "dialog") {
    const titleFill = kind === "window" ? "#eef0f2" : "#e6e6e6";
    const titleBarHeight = 26;
    return `<g transform="translate(${shape.position.x} ${shape.position.y})">
      ${paths(sketchRoundedRect(w, h, seed, { stroke, fill: "#ffffff" }, 5))}
      ${paths(sketchRect(w, titleBarHeight, seedFor(shape.id, "titlebar"), { stroke, fill: titleFill }))}
      ${paths(sketchCircle(16, titleBarHeight / 2, 8, seedFor(shape.id, "sysicon"), { stroke }))}
      ${multilineTextMarkup(label || (kind === "window" ? "Fenster" : "Dialog"), w / 2 + 8, titleBarHeight / 2 + 4, "#333333", 12, false)}
      ${paths(sketchLine(w - 20, 8, w - 8, titleBarHeight - 8, seedFor(shape.id, "closeA"), { stroke }))}
      ${paths(sketchLine(w - 8, 8, w - 20, titleBarHeight - 8, seedFor(shape.id, "closeB"), { stroke }))}
    </g>`;
  }

  if (kind === "panel") {
    return `<g transform="translate(${shape.position.x} ${shape.position.y})">
      ${paths(sketchRoundedRect(w, h, seed, { stroke }, 4))}
      ${label ? multilineTextMarkup(label, 10, 14, "#333333", 11.5, false) : ""}
    </g>`;
  }

  if (kind === "tabContainer") {
    const tabs = parseItems(shape.data.items, ["Übersicht", "Details", "Verlauf"]);
    const tabW = 70;
    const tabH = 22;
    const body = paths(sketchRect(w, h - tabH, seedFor(shape.id, "body"), { stroke }));
    const tabsMarkup = tabs
      .map(
        (tab, i) =>
          `<g transform="translate(${i * tabW} 0)">${paths(sketchRect(tabW, tabH, seedFor(shape.id, `tab${i}`), { stroke }))}${multilineTextMarkup(tab, tabW / 2, tabH / 2 + 4, "#333333", 10.5, false)}</g>`
      )
      .join("");
    return `<g transform="translate(${shape.position.x} ${shape.position.y})">${body}${tabsMarkup}</g>`;
  }

  if (kind === "splitter") {
    return `<g transform="translate(${shape.position.x} ${shape.position.y})">${paths(sketchLine(w / 2, 0, w / 2, h, seed, { stroke, strokeWidth: 1.6 }))}</g>`;
  }

  if (kind === "statusBar") {
    return `<g transform="translate(${shape.position.x} ${shape.position.y})">
      ${paths(sketchRect(w, h, seed, { stroke, fill: "#f4f4f4" }))}
      ${multilineTextMarkup(label || "Bereit", 10, h / 2 + 4, "#333333", 10.5, false)}
    </g>`;
  }

  if (kind === "menuBar") {
    const items = parseItems(shape.data.items, ["Datei", "Bearbeiten", "Ansicht", "Hilfe"]);
    const gap = w / items.length;
    const itemsMarkup = items.map((item, i) => multilineTextMarkup(item, gap * i + gap / 2, h / 2 + 4, "#333333", 11, false)).join("");
    return `<g transform="translate(${shape.position.x} ${shape.position.y})">${paths(sketchRect(w, h, seed, { stroke, fill: "#f4f4f4" }))}${itemsMarkup}</g>`;
  }

  if (kind === "dropdownMenu") {
    const items = parseItems(shape.data.items, ["Neu", "Öffnen…", "Speichern", "Beenden"]);
    const rowH = h / items.length;
    const rows = items
      .map((item, i) => {
        const sep = i > 0 ? paths(sketchLine(4, rowH * i, w - 4, rowH * i, seedFor(shape.id, `sep${i}`), { strokeWidth: 0.8, stroke })) : "";
        return sep + multilineTextMarkup(item, 12, rowH * i + rowH / 2 + 4, "#333333", 11, false);
      })
      .join("");
    return `<g transform="translate(${shape.position.x} ${shape.position.y})">${paths(sketchRect(w, h, seed, { stroke, fill: "#ffffff" }))}${rows}</g>`;
  }

  if (kind === "toolbar") {
    const btnCount = Math.max(1, Math.floor((w - 8) / (h + 4)));
    const btns = Array.from({ length: btnCount })
      .map((_, i) => `<g transform="translate(${4 + i * h} 4)">${paths(sketchRect(h - 8, h - 8, seedFor(shape.id, `btn${i}`), { stroke }))}</g>`)
      .join("");
    return `<g transform="translate(${shape.position.x} ${shape.position.y})">${paths(sketchRect(w, h, seed, { stroke, fill: "#f4f4f4" }))}${btns}</g>`;
  }

  if (kind === "ribbon") {
    const groupCount = 3;
    const groupW = w / groupCount;
    const groups = Array.from({ length: groupCount })
      .map((_, g) => {
        const sep = g > 0 ? paths(sketchLine(g * groupW, 0, g * groupW, h - 12, seedFor(shape.id, `sep${g}`), { stroke, strokeWidth: 0.8 })) : "";
        return `<g transform="translate(${g * groupW + 6} 6)">${paths(sketchRect(20, 20, seedFor(shape.id, `ic${g}a`), { stroke }))}${paths(sketchRect(20, 20, seedFor(shape.id, `ic${g}b`), { stroke }))}</g>${sep}`;
      })
      .join("");
    return `<g transform="translate(${shape.position.x} ${shape.position.y})">${paths(sketchRect(w, h, seed, { stroke, fill: "#f4f4f4" }))}${groups}</g>`;
  }

  if (kind === "textField" || kind === "combobox" || kind === "searchField" || kind === "spinner") {
    const extra: string[] = [];
    if (kind === "combobox") {
      extra.push(paths(sketchPath(`M ${w - 22} ${h / 2 - 3} L ${w - 14} ${h / 2 + 4} L ${w - 6} ${h / 2 - 3}`, seedFor(shape.id, "chev"), { stroke })));
    }
    if (kind === "searchField") {
      extra.push(paths(sketchCircle(16, h / 2 - 1, 9, seedFor(shape.id, "lens"), { stroke })));
      extra.push(paths(sketchLine(20, h / 2 + 3, 24, h / 2 + 7, seedFor(shape.id, "handle"), { stroke })));
    }
    if (kind === "spinner") {
      extra.push(paths(sketchLine(w - 20, 0, w - 20, h, seedFor(shape.id, "div"), { stroke, strokeWidth: 0.8 })));
      extra.push(paths(sketchPath(`M ${w - 15} ${h / 2 - 1} L ${w - 10} ${h / 2 - 6} L ${w - 5} ${h / 2 - 1}`, seedFor(shape.id, "up"), { stroke })));
      extra.push(paths(sketchPath(`M ${w - 15} ${h / 2 + 1} L ${w - 10} ${h / 2 + 6} L ${w - 5} ${h / 2 + 1}`, seedFor(shape.id, "down"), { stroke })));
    }
    const placeholder = kind === "searchField" ? "Suchen…" : label || (kind === "combobox" ? "Bitte wählen…" : "");
    const textFill = kind === "textField" || kind === "searchField" ? "#999999" : "#333333";
    return `<g transform="translate(${shape.position.x} ${shape.position.y})">
      ${paths(sketchRoundedRect(w, h, seed, { stroke, fill: "#ffffff" }))}
      ${extra.join("")}
      ${placeholder ? multilineTextMarkup(placeholder, kind === "searchField" ? 30 : 8, h / 2 + 4, textFill, 11.5, false) : ""}
    </g>`;
  }

  if (kind === "textArea") {
    const lineCount = Math.max(1, Math.floor((h - 16) / 16));
    const lines = Array.from({ length: lineCount })
      .map((_, i) => paths(sketchLine(8, 14 + i * 16, w - 8 - (i === lineCount - 1 ? w * 0.35 : 0), 14 + i * 16, seedFor(shape.id, `l${i}`), { stroke: "#8a8a8a", strokeWidth: 2 })))
      .join("");
    return `<g transform="translate(${shape.position.x} ${shape.position.y})">${paths(sketchRoundedRect(w, h, seed, { stroke, fill: "#ffffff" }))}${lines}</g>`;
  }

  if (kind === "checkbox" || kind === "radio") {
    const checked = (shape.data.checked as boolean) ?? true;
    const text = label || "Option";
    if (kind === "checkbox") {
      const box = Math.min(18, h);
      const check = checked ? paths(sketchPath(`M ${box * 0.2} ${box * 0.55} L ${box * 0.42} ${box * 0.78} L ${box * 0.82} ${box * 0.22}`, seedFor(shape.id, "check"), { stroke, strokeWidth: 1.8 })) : "";
      return `<g transform="translate(${shape.position.x} ${shape.position.y})">${paths(sketchRoundedRect(box, box, seed, { stroke }))}${check}${multilineTextMarkup(text, box + 8, h / 2 + 4, "#333333", 12, false)}</g>`;
    }
    const d = Math.min(18, h);
    const dot = checked ? paths(sketchCircle(d / 2, h / 2, d * 0.4, seedFor(shape.id, "dot"), { stroke, fill: stroke, roughness: 0.4 })) : "";
    return `<g transform="translate(${shape.position.x} ${shape.position.y})">${paths(sketchCircle(d / 2, h / 2, d, seed, { stroke }))}${dot}${multilineTextMarkup(text, d + 10, h / 2 + 4, "#333333", 12, false)}</g>`;
  }

  if (kind === "slider") {
    const value = (shape.data.value as number) ?? 0.5;
    const handleX = 10 + value * (w - 20);
    return `<g transform="translate(${shape.position.x} ${shape.position.y})">
      ${paths(sketchLine(6, h / 2, w - 6, h / 2, seed, { stroke, strokeWidth: 1.8 }))}
      ${paths(sketchCircle(handleX, h / 2, 14, seedFor(shape.id, "handle"), { stroke, fill: "#ffffff" }))}
    </g>`;
  }

  if (kind === "button" || kind === "iconButton") {
    const inner = kind === "iconButton"
      ? paths(sketchSparkle(w / 2, h / 2, Math.min(w, h) * 0.32, seedFor(shape.id, "glyph"), { stroke, fill: "#f4f4f4" }))
      : multilineTextMarkup(label || "Button", w / 2, h / 2 + 4, "#333333", 12.5);
    const fill = kind === "button" ? "#f4f4f4" : "#ffffff";
    const strokeWidth = kind === "button" ? 2 : undefined;
    return `<g transform="translate(${shape.position.x} ${shape.position.y})">${paths(sketchRoundedRect(w, h, seed, { stroke, fill, ...(strokeWidth ? { strokeWidth } : {}) }))}${inner}</g>`;
  }

  if (kind === "toggleSwitch") {
    const on = (shape.data.on as boolean) ?? true;
    const handleX = on ? w - h / 2 : h / 2;
    return `<g transform="translate(${shape.position.x} ${shape.position.y})">
      ${paths(sketchRoundedRect(w, h, seed, { stroke, fill: on ? "#f4f4f4" : "#ffffff" }, h / 2))}
      ${paths(sketchCircle(handleX, h / 2, h * 0.7, seedFor(shape.id, "handle"), { stroke, fill: "#ffffff" }))}
    </g>`;
  }

  if (kind === "segmentedControl") {
    const items = parseItems(shape.data.items, ["Liste", "Raster"]);
    const segW = w / items.length;
    const segs = items
      .map((item, i) => {
        const sep = i > 0 ? paths(sketchLine(segW * i, 0, segW * i, h, seedFor(shape.id, `sep${i}`), { stroke, strokeWidth: 1.2 })) : "";
        return sep + multilineTextMarkup(item, segW * i + segW / 2, h / 2 + 4, "#333333", 11.5);
      })
      .join("");
    return `<g transform="translate(${shape.position.x} ${shape.position.y})">${paths(sketchRoundedRect(w, h, seed, { stroke, fill: "#ffffff" }))}${segs}</g>`;
  }

  if (kind === "list" || kind === "tree") {
    const items = parseItems(shape.data.items, kind === "list" ? ["Eintrag 1", "Eintrag 2", "Eintrag 3", "Eintrag 4"] : ["Projekte", "  Berichte", "  Archiv", "Vorlagen", "Papierkorb"]);
    const rowH = h / items.length;
    const rows = items
      .map((raw, i) => {
        if (kind === "list") {
          const sep = i > 0 ? paths(sketchLine(4, rowH * i, w - 4, rowH * i, seedFor(shape.id, `sep${i}`), { stroke, strokeWidth: 0.8 })) : "";
          return sep + multilineTextMarkup(raw, 10, rowH * i + rowH / 2 + 4, "#333333", 11.5, false);
        }
        const indentLevel = (raw.match(/^ */)?.[0].length ?? 0) / 2;
        const text = raw.trimStart();
        const x = 8 + indentLevel * 14;
        const box = indentLevel === 0 ? `<g transform="translate(8 ${rowH * i + rowH / 2 - 4.5})">${paths(sketchRect(9, 9, seedFor(shape.id, `box${i}`), { stroke }))}</g>` : "";
        return box + multilineTextMarkup(text, x + (indentLevel === 0 ? 14 : 0), rowH * i + rowH / 2 + 4, "#333333", 11, false);
      })
      .join("");
    return `<g transform="translate(${shape.position.x} ${shape.position.y})">${paths(sketchRect(w, h, seed, { stroke, fill: "#ffffff" }))}${rows}</g>`;
  }

  if (kind === "table") {
    const columns = parseItems(shape.data.columns, ["Name", "Datum", "Status"]);
    const rows = parseItems(shape.data.items, ["Zeile 1", "Zeile 2", "Zeile 3"]);
    const headerH = 24;
    const rowH = (h - headerH) / rows.length;
    const colW = w / columns.length;
    const headerMarkup = columns
      .map((col, i) => multilineTextMarkup(col, colW * i + 8, headerH / 2 + 4, "#333333", 11, false) + (i > 0 ? paths(sketchLine(colW * i, 0, colW * i, h, seedFor(shape.id, `col${i}`), { stroke, strokeWidth: 0.8 })) : ""))
      .join("");
    const rowsMarkup = rows
      .map((row, i) => (i > 0 ? paths(sketchLine(0, headerH + rowH * i, w, headerH + rowH * i, seedFor(shape.id, `row${i}`), { stroke, strokeWidth: 0.6 })) : "") + multilineTextMarkup(row, 8, headerH + rowH * i + rowH / 2 + 4, "#333333", 10.5, false))
      .join("");
    return `<g transform="translate(${shape.position.x} ${shape.position.y})">
      ${paths(sketchRect(w, h, seed, { stroke, fill: "#ffffff" }))}
      ${paths(sketchLine(0, headerH, w, headerH, seedFor(shape.id, "headersep"), { stroke, strokeWidth: 1.4 }))}
      ${headerMarkup}${rowsMarkup}
    </g>`;
  }

  if (kind === "progressBar") {
    const progress = Math.min(1, Math.max(0, (shape.data.progress as number) ?? 0.6));
    return `<g transform="translate(${shape.position.x} ${shape.position.y})">
      ${paths(sketchRect(w, h, seed, { stroke, fill: "#ffffff" }))}
      ${paths(sketchRect(w * progress, h, seedFor(shape.id, "fill"), { stroke, fill: "#8a8a8a" }))}
    </g>`;
  }

  if (kind === "imagePlaceholder") {
    return `<g transform="translate(${shape.position.x} ${shape.position.y})">
      ${paths(sketchRoundedRect(w, h, seed, { stroke, fill: "#ffffff" }, 4))}
      ${paths(sketchCircle(w * 0.64, h * 0.2, Math.min(w, h) * 0.14, seedFor(shape.id, "sun"), { stroke }))}
      ${paths(sketchLine(w * 0.1, h * 0.75, w * 0.4, h * 0.4, seedFor(shape.id, "m1"), { stroke }))}
      ${paths(sketchLine(w * 0.4, h * 0.4, w * 0.62, h * 0.62, seedFor(shape.id, "m2"), { stroke }))}
      ${paths(sketchLine(w * 0.62, h * 0.62, w * 0.85, h * 0.3, seedFor(shape.id, "m3"), { stroke }))}
      ${paths(sketchLine(w * 0.85, h * 0.3, w * 0.92, h * 0.75, seedFor(shape.id, "m4"), { stroke }))}
      ${paths(sketchLine(w * 0.08, h * 0.75, w * 0.92, h * 0.75, seedFor(shape.id, "ground"), { stroke }))}
    </g>`;
  }

  if (kind === "card") {
    const imgH = h * 0.55;
    return `<g transform="translate(${shape.position.x} ${shape.position.y})">
      ${paths(sketchRoundedRect(w, h, seed, { stroke, fill: "#ffffff" }))}
      <g transform="translate(8 8)">${paths(sketchRoundedRect(w - 16, imgH - 10, seedFor(shape.id, "img"), { stroke }, 3))}</g>
      ${multilineTextMarkup(label || "Titel", 8, imgH + 18, "#333333", 11.5, false)}
      ${paths(sketchLine(8, imgH + 28, w - 24, imgH + 28, seedFor(shape.id, "l1"), { stroke: "#8a8a8a", strokeWidth: 2 }))}
    </g>`;
  }

  if (kind === "heading" || kind === "label") {
    return `<g transform="translate(${shape.position.x} ${shape.position.y})">${multilineTextMarkup(label || (kind === "heading" ? "Überschrift" : "Label"), w / 2, h / 2 + 6, "#333333", kind === "heading" ? 20 : 12.5)}</g>`;
  }

  if (kind === "link") {
    return `<g transform="translate(${shape.position.x} ${shape.position.y})">
      ${multilineTextMarkup(label || "Link", w / 2, h / 2 + 2, "#333333", 12.5)}
      ${paths(sketchLine(w * 0.15, h / 2 + 8, w * 0.85, h / 2 + 8, seedFor(shape.id, "underline"), { stroke, strokeWidth: 1 }))}
    </g>`;
  }

  if (kind === "paragraph") {
    const lineCount = Math.max(2, Math.floor(h / 16));
    const lines = Array.from({ length: lineCount })
      .map((_, i) => {
        const isLast = i === lineCount - 1;
        return paths(sketchLine(0, i * 16, isLast ? w * 0.55 : w, i * 16, seedFor(shape.id, `l${i}`), { stroke: "#8a8a8a", strokeWidth: 2.4 }));
      })
      .join("");
    return `<g transform="translate(${shape.position.x} ${shape.position.y})">${lines}</g>`;
  }

  if (kind === "commentBubble") {
    const tailW = Math.min(20, w * 0.2);
    const bodyH = h - 14;
    const d = `M 2 2 L ${w - 2} 2 L ${w - 2} ${bodyH} L ${tailW * 2} ${bodyH} L ${tailW} ${h - 2} L ${tailW} ${bodyH} L 2 ${bodyH} Z`;
    return `<g transform="translate(${shape.position.x} ${shape.position.y})">
      ${paths(sketchPath(d, seed, { stroke, fill: "#fff8e0" }))}
      ${multilineTextMarkup(label || "Hinweis", w / 2, bodyH / 2 + 4, "#333333", 12)}
    </g>`;
  }

  if (kind === "highlightBox") {
    return `<g transform="translate(${shape.position.x} ${shape.position.y})">${paths(sketchRoundedRect(w, h, seed, { stroke: "#c0392b", strokeWidth: 1.8, strokeLineDash: [6, 4] }, 4))}</g>`;
  }

  if (kind === "tooltip") {
    const tailW = 10;
    const bodyH = h - 8;
    const d = `M 2 2 L ${w - 2} 2 L ${w - 2} ${bodyH} L ${w / 2 + tailW} ${bodyH} L ${w / 2} ${h - 2} L ${w / 2 - tailW} ${bodyH} L 2 ${bodyH} Z`;
    return `<g transform="translate(${shape.position.x} ${shape.position.y})">
      ${paths(sketchPath(d, seed, { stroke, fill: "#333333" }))}
      ${multilineTextMarkup(label || "Tooltip-Text", w / 2, bodyH / 2 + 4, "#ffffff", 11)}
    </g>`;
  }

  if (kind === "scrollbar") {
    const isVertical = h >= w;
    const thumbLength = (isVertical ? h : w) * 0.4;
    const thumb = isVertical
      ? paths(sketchRect(w - 4, thumbLength, seedFor(shape.id, "thumb"), { stroke, fill: "#8a8a8a" }))
      : paths(sketchRect(thumbLength, h - 4, seedFor(shape.id, "thumb"), { stroke, fill: "#8a8a8a" }));
    return `<g transform="translate(${shape.position.x} ${shape.position.y})">${paths(sketchRect(w, h, seed, { stroke, fill: "#f4f4f4" }))}${thumb}</g>`;
  }

  if (kind === "accordion") {
    const HEADER_H = 24;
    const sections = parseItems(shape.data.items, ["Allgemein", "Erweitert", "Info"]);
    const bodyHeight = Math.max(0, h - sections.length * HEADER_H);
    let cursorY = 0;
    const rows = sections
      .map((section, i) => {
        const y = cursorY;
        const expanded = i === 0;
        cursorY += HEADER_H + (expanded ? bodyHeight : 0);
        const header = `<g transform="translate(0 ${y})">${paths(sketchRect(w, HEADER_H, seedFor(shape.id, `hdr${i}`), { stroke, fill: "#f4f4f4" }))}${multilineTextMarkup(`${expanded ? "▾" : "▸"} ${section}`, 10, HEADER_H / 2 + 4, "#333333", 11, false)}${expanded ? `<g transform="translate(0 ${HEADER_H})">${paths(sketchRect(w, bodyHeight, seedFor(shape.id, "body"), { stroke }))}</g>` : ""}</g>`;
        return header;
      })
      .join("");
    return `<g transform="translate(${shape.position.x} ${shape.position.y})">${rows}</g>`;
  }

  if (kind === "messageBox") {
    const btnW = 70;
    const btnH = 26;
    return `<g transform="translate(${shape.position.x} ${shape.position.y})">
      ${paths(sketchRoundedRect(w, h, seed, { stroke, fill: "#ffffff" }, 5))}
      ${paths(sketchCircle(24, 30, 24, seedFor(shape.id, "icon"), { stroke }))}
      ${multilineTextMarkup("!", 24, 38, "#333333", 18)}
      ${multilineTextMarkup(label || "Möchten Sie fortfahren?", w / 2 + 16, 34, "#333333", 12)}
      <g transform="translate(${w - btnW - 12} ${h - btnH - 10})">
        ${paths(sketchRoundedRect(btnW, btnH, seedFor(shape.id, "ok"), { stroke }, 4))}
        ${multilineTextMarkup("OK", btnW / 2, btnH / 2 + 4, "#333333", 11.5)}
      </g>
    </g>`;
  }

  if (kind === "breadcrumb") {
    const items = parseItems(shape.data.items, ["Start", "Projekte", "Jahresbericht"]);
    let cursorX = 0;
    const segs = items
      .map((item, i) => {
        const x = cursorX;
        cursorX += item.length * 6.5 + 20;
        const isLast = i === items.length - 1;
        const text = multilineTextMarkup(item, x, h / 2 + 4, isLast ? "#333333" : stroke, 11.5, false);
        const chevron = !isLast ? multilineTextMarkup("›", x + item.length * 6.5 + 8, h / 2 + 4, stroke, 12, false) : "";
        return text + chevron;
      })
      .join("");
    return `<g transform="translate(${shape.position.x} ${shape.position.y})">${segs}</g>`;
  }

  if (kind === "datePicker") {
    const iconX = w - 24;
    return `<g transform="translate(${shape.position.x} ${shape.position.y})">
      ${paths(sketchRoundedRect(w, h, seed, { stroke, fill: "#ffffff" }))}
      <g transform="translate(${iconX} ${h / 2 - 7})">
        ${paths(sketchRoundedRect(16, 14, seedFor(shape.id, "cal"), { stroke }, 2))}
        ${paths(sketchLine(0, 4.5, 16, 4.5, seedFor(shape.id, "calbar"), { stroke, strokeWidth: 1 }))}
        ${paths(sketchLine(4, 0, 4, 3, seedFor(shape.id, "ring1"), { stroke, strokeWidth: 1.4 }))}
        ${paths(sketchLine(12, 0, 12, 3, seedFor(shape.id, "ring2"), { stroke, strokeWidth: 1.4 }))}
      </g>
      ${multilineTextMarkup(label || "TT.MM.JJJJ", 8, h / 2 + 4, "#999999", 11.5, false)}
    </g>`;
  }

  if (kind === "chart") {
    const barHeights = [0.5, 0.85, 0.35, 0.7, 0.55];
    const padding = 8;
    const innerW = w - padding * 2;
    const innerH = h - padding * 2;
    const barGap = 6;
    const barW = (innerW - barGap * (barHeights.length - 1)) / barHeights.length;
    const bars = barHeights
      .map((ratio, i) => {
        const barH = innerH * ratio;
        const x = padding + i * (barW + barGap);
        const y = h - padding - barH;
        return `<g transform="translate(${x} ${y})">${paths(sketchRect(barW, barH, seedFor(shape.id, `bar${i}`), { stroke, fill: "#8a8a8a" }))}</g>`;
      })
      .join("");
    return `<g transform="translate(${shape.position.x} ${shape.position.y})">
      ${paths(sketchRect(w, h, seed, { stroke, fill: "#ffffff" }))}
      ${paths(sketchLine(padding, h - padding, w - padding, h - padding, seedFor(shape.id, "axis"), { stroke }))}
      ${bars}
    </g>`;
  }

  if (kind === "icon") {
    const r = Math.min(w, h) * 0.42;
    return `<g transform="translate(${shape.position.x} ${shape.position.y})">${paths(sketchSparkle(w / 2, h / 2, r, seed, { stroke, fill: "#f4f4f4" }))}</g>`;
  }

  // Fallback für unbekannte/zukünftige Wireframe-Typen: einfache skizzierte Box.
  return `<g transform="translate(${shape.position.x} ${shape.position.y})">
    ${paths(sketchRect(w, h, seed, { stroke, fill: "#ffffff" }))}
    ${label ? multilineTextMarkup(label, w / 2, h / 2 + 5, "#333333", 12) : ""}
  </g>`;
}

function renderShapeToStaticSvg(shape: ShapeInstance): string {
  const { x, y } = shape.position;
  const { width: w, height: h } = shape.size;
  const label = (shape.data.label as string) ?? "";
  const labelMarkup = label ? multilineTextMarkup(label, w / 2, h / 2 + 5, "#2f3540", 13) : "";

  if (shape.type.startsWith("wireframe.")) {
    return renderWireframeShapeToStaticSvg(shape);
  }

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
