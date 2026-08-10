/**
 * Statische SVG-Ausgabe der BPMN-Shapes für den Bild-Export.
 *
 * Liegt im Modul, nicht in `core/io/imageExport.ts`: Wie ein Gateway oder ein
 * Boundary Event aussieht, ist BPMN-Wissen und hat im Core nichts verloren
 * (Kernregel: `core/` kennt kein Modul). Registriert wird der Renderer in
 * `modules/bpmn/index.ts` über `ShapeRegistry.setStaticSvgRenderer`.
 *
 * ACHTUNG, weiterhin doppelte Pflege: Dies ist eine eigenständige
 * Nachbildung der React-Komponenten aus `../shapes/*.tsx`, kein geteilter
 * Code. Wer dort etwas ändert, muss es hier nachziehen - sonst weicht der
 * Export still vom Bildschirm ab. `npm run check:export` vergleicht beide
 * Darstellungen pixelweise und meldet genau das.
 */
import type { ShapeInstance } from "../../../core/shapes/types";
import { multilineTextMarkup } from "../../../core/io/staticSvgPrimitives";
import {
  resolveFill,
  resolveStroke,
  resolveStrokeWidth,
  dashAttr as styleDashAttr,
} from "../../../core/shapes/shapeStyle";

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

export function renderBpmnShapeToStaticSvg(shape: ShapeInstance): string {
  const { x, y } = shape.position;
  const { width: w, height: h } = shape.size;
  const label = (shape.data.label as string) ?? "";
  const labelMarkup = label ? multilineTextMarkup(label, w / 2, h / 2 + 6, "#2f3540", 13) : "";
  // Stil-Panel-Overrides (Z-15) - dieselben Resolver, die die Live-Komponenten
  // in modules/bpmn/shapes/*.tsx benutzen. Ohne sie exportiert der Renderer
  // stets die Default-Palette, egal was der Nutzer eingestellt hat.
  const sf = (fallback: string) => resolveFill(shape, fallback);
  const ss = (fallback: string) => resolveStroke(shape, fallback);
  const sw = (fallback: number) => resolveStrokeWidth(shape, fallback);
  const sd = (fallback?: string) => styleDashAttr(shape, fallback);

  if (shape.type.startsWith("bpmn.boundaryEvent.")) {
    const r = w / 2;
    const trigger = (shape.data.trigger as string) ?? "timer";
    const isInterrupting = (shape.data.interrupting as boolean) ?? true;
    const dashAttr = isInterrupting ? "" : ' stroke-dasharray="3 2"';
    const labelBelow = label ? multilineTextMarkup(label, r, h + 12, "#2f3540", 11, false) : "";
    return `<g transform="translate(${x} ${y})">
      <circle cx="${r}" cy="${r}" r="${r - 1}" fill="${sf("#ffffff")}" stroke="${ss("#454d5a")}" stroke-width="${sw(2)}"${dashAttr} />
      <circle cx="${r}" cy="${r}" r="${r - 5}" fill="none" stroke="${ss("#454d5a")}" stroke-width="1.3"${dashAttr} />
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
        ? `<circle cx="${r}" cy="${r}" r="${r - strokeWidth - 2.5}" fill="none" stroke="${ss("#454d5a")}" stroke-width="1.5" />`
        : "";
    const labelBelow = label ? multilineTextMarkup(label, r, h + 14, "#2f3540", 12, false) : "";
    return `<g transform="translate(${x} ${y})">
      <circle cx="${r}" cy="${r}" r="${r - strokeWidth / 2}" fill="${sf("#ffffff")}" stroke="${ss("#454d5a")}" stroke-width="${sw(strokeWidth)}"${sd()} />
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
      : multilineTextMarkup(label || "Sub-Prozess", w / 2, h / 2, "#2f3540", 13);
    const verticalLine = !isExpanded
      ? `<line x1="${markerCx}" y1="${markerCy - 4}" x2="${markerCx}" y2="${markerCy + 4}" stroke="#454d5a" stroke-width="1.4" />`
      : "";
    return `<g transform="translate(${x} ${y})">
      <rect width="${w}" height="${h}" rx="8" fill="${sf(isExpanded ? "#ffffff" : "#f8fafc")}" stroke="${ss("#454d5a")}" stroke-width="${sw(1.5)}"${sd()} />
      ${labelMarkupSub}
      <rect x="${markerCx - markerSize / 2}" y="${markerCy - markerSize / 2}" width="${markerSize}" height="${markerSize}" rx="2" fill="#ffffff" stroke="#454d5a" stroke-width="1.2" />
      <line x1="${markerCx - 4}" y1="${markerCy}" x2="${markerCx + 4}" y2="${markerCy}" stroke="#454d5a" stroke-width="1.4" />
      ${verticalLine}
    </g>`;
  }

  if (shape.type.startsWith("bpmn.task.")) {
    const kind = (shape.data.taskType as string) ?? "user";
    return `<g transform="translate(${x} ${y})">
      <rect width="${w}" height="${h}" rx="8" fill="${sf("#f8fafc")}" stroke="${ss("#454d5a")}" stroke-width="${sw(1.5)}"${sd()} />
      ${taskIconMarkup(kind)}
      ${labelMarkup}
    </g>`;
  }

  if (shape.type.startsWith("bpmn.gateway.")) {
    const kind = (shape.data.gatewayType as string) ?? "exclusive";
    const points = `${w / 2},0 ${w},${h / 2} ${w / 2},${h} 0,${h / 2}`;
    const labelBelow = label ? multilineTextMarkup(label, w / 2, h + 16, "#2f3540", 12, false) : "";
    return `<g transform="translate(${x} ${y})">
      <polygon points="${points}" fill="${sf("#ffffff")}" stroke="${ss("#454d5a")}" stroke-width="${sw(1.5)}"${sd()} />
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
      <path d="${outline}" fill="${sf("#ffffff")}" stroke="${ss("#454d5a")}" stroke-width="${sw(1.5)}"${sd()} />
      <path d="${foldLine}" fill="none" stroke="${ss("#454d5a")}" stroke-width="1.5" />
      ${labelBelow}
    </g>`;
  }

  if (shape.type === "bpmn.pool" || shape.type === "bpmn.lane") {
    const titleBand = 24;
    // Pool und Lane teilen sich diesen Zweig, unterscheiden sich live aber in
    // Fuellung und Linienstaerke (PoolLaneShapes.tsx): die Lane ist bewusst
    // leichter gezeichnet, damit sich mehrere Lanes in einem Pool stapeln
    // lassen, ohne sich mit vollen Rahmen zu ueberdecken.
    const istPool = shape.type === "bpmn.pool";
    return `<g transform="translate(${x} ${y})">
      <rect width="${w}" height="${h}" fill="${sf(istPool ? "#ffffff" : "rgba(255,255,255,0.4)")}" stroke="${ss("#454d5a")}" stroke-width="${sw(istPool ? 1.5 : 1)}"${sd()} />
      <rect width="${titleBand}" height="${h}" fill="${istPool ? "#eef1f8" : "#f6f7fa"}" stroke="${ss("#454d5a")}" stroke-width="${istPool ? 1.5 : 1}" />
      <g transform="translate(${titleBand / 2} ${h / 2}) rotate(-90)">${multilineTextMarkup(label || (shape.type === "bpmn.pool" ? "Pool" : "Lane"), 0, 0, "#2f3540", shape.type === "bpmn.pool" ? 13 : 12)}</g>
    </g>`;
  }

  if (shape.type === "text.label") {
    const showBorder = (shape.data.showBorder as boolean) ?? false;
    const borderMarkup = showBorder
      ? `<rect width="${w}" height="${h}" fill="${sf("#ffffff")}" stroke="${ss("#454d5a")}" stroke-width="${sw(1.5)}"${sd()} />`
      : "";
    return `<g transform="translate(${x} ${y})">
      ${borderMarkup}
      ${multilineTextMarkup(label || "Text", w / 2, h / 2, "#2f3540", 14)}
    </g>`;
  }

  return `<g transform="translate(${x} ${y})">
    <rect width="${w}" height="${h}" rx="6" fill="${sf("#ffffff")}" stroke="${ss("#2f3540")}" stroke-width="${sw(1.5)}"${sd()} />
    ${labelMarkup}
  </g>`;
}
