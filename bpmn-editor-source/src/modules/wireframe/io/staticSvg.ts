/**
 * Statische SVG-Ausgabe der Wireframe-Shapes für den Bild-Export.
 *
 * Liegt im Modul, nicht in `core/io/imageExport.ts`: Wie ein Wireframe-Button
 * aussieht, ist Modul-Wissen. Zuvor stand dieser Renderer im Core und
 * importierte von dort `modules/wireframe/shapes/sketch` - genau die
 * Abhängigkeitsrichtung, die die Kernregel ("`core/` kennt kein Modul")
 * verbietet. Registriert wird er in `modules/wireframe/index.ts` über
 * `ShapeRegistry.setStaticSvgRenderer`.
 *
 * Die Umriss-Geometrie stammt aus denselben `sketch*`-Primitiven wie der
 * Live-Renderer - dieselben Pfaddaten, nur einmal als JSX und einmal als
 * String. Füllung und Textplatzierung werden dagegen hier eigenständig
 * bestimmt und müssen bei Änderungen am Live-Renderer mitgezogen werden;
 * `npm run check:export` vergleicht beides pixelweise.
 */
import type { ShapeInstance } from "../../../core/shapes/types";
import { multilineTextMarkup } from "../../../core/io/staticSvgPrimitives";
import {
  sketchRect,
  sketchRoundedRect,
  sketchLine,
  sketchCircle,
  sketchPath,
  sketchSparkle,
  sketchPathsToSvgString,
  seedFor,
  parseItems,
} from "../shapes/sketch";

export function renderWireframeShapeToStaticSvg(shape: ShapeInstance): string {
  const { width: w, height: h } = shape.size;
  const kind = shape.type.slice("wireframe.".length);
  const stroke = "#4a4a4a";
  const label = (shape.data.label as string) ?? "";
  const seed = seedFor(shape.id);
  // `shape` mitgeben, damit die Stil-Panel-Overrides (Z-15) hier genauso
  // greifen wie im Live-Renderer - beide gehen durch applySketchStyleOverride.
  const paths = (p: ReturnType<typeof sketchRect>) => sketchPathsToSvgString(p, shape);

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
      ${label ? multilineTextMarkup(label, 10, 14, "#333333", 11.5, false, "start") : ""}
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
      ${multilineTextMarkup(label || "Bereit", 10, h / 2 + 4, "#333333", 10.5, false, "start")}
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
        return sep + multilineTextMarkup(item, 12, rowH * i + rowH / 2 + 4, "#333333", 11, false, "start");
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
      ${placeholder ? multilineTextMarkup(placeholder, kind === "searchField" ? 30 : kind === "spinner" ? 10 : 8, h / 2 + 4, textFill, kind === "searchField" ? 11 : kind === "spinner" ? 12 : 11.5, false, "start") : ""}
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
      return `<g transform="translate(${shape.position.x} ${shape.position.y})">${paths(sketchRoundedRect(box, box, seed, { stroke }))}${check}${multilineTextMarkup(text, box + 8, h / 2 + 4, "#333333", 12, false, "start")}</g>`;
    }
    const d = Math.min(18, h);
    const dot = checked ? paths(sketchCircle(d / 2, h / 2, d * 0.4, seedFor(shape.id, "dot"), { stroke, fill: stroke, fillStyle: "solid", roughness: 0.4 })) : "";
    return `<g transform="translate(${shape.position.x} ${shape.position.y})">${paths(sketchCircle(d / 2, h / 2, d, seed, { stroke }))}${dot}${multilineTextMarkup(text, d + 10, h / 2 + 4, "#333333", 12, false, "start")}</g>`;
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
      ? paths(sketchSparkle(w / 2, h / 2, Math.min(w, h) * 0.32, seedFor(shape.id, "glyph"), { stroke, fill: "#f4f4f4", fillStyle: "solid" }))
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
          return sep + multilineTextMarkup(raw, 10, rowH * i + rowH / 2 + 4, "#333333", 11.5, false, "start");
        }
        const indentLevel = (raw.match(/^ */)?.[0].length ?? 0) / 2;
        const text = raw.trimStart();
        const x = 8 + indentLevel * 14;
        const box = indentLevel === 0 ? `<g transform="translate(8 ${rowH * i + rowH / 2 - 4.5})">${paths(sketchRect(9, 9, seedFor(shape.id, `box${i}`), { stroke }))}</g>` : "";
        return box + multilineTextMarkup(text, x + (indentLevel === 0 ? 14 : 0), rowH * i + rowH / 2 + 4, "#333333", 11, false, "start");
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
      .map((col, i) => multilineTextMarkup(col, colW * i + 8, headerH / 2 + 4, "#333333", 11, false, "start") + (i > 0 ? paths(sketchLine(colW * i, 0, colW * i, h, seedFor(shape.id, `col${i}`), { stroke, strokeWidth: 0.8 })) : ""))
      .join("");
    const rowsMarkup = rows
      .map((row, i) => (i > 0 ? paths(sketchLine(0, headerH + rowH * i, w, headerH + rowH * i, seedFor(shape.id, `row${i}`), { stroke, strokeWidth: 0.6 })) : "") + multilineTextMarkup(row, 8, headerH + rowH * i + rowH / 2 + 4, "#333333", 10.5, false, "start"))
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
      ${paths(sketchRect(w * progress, h, seedFor(shape.id, "fill"), { stroke, fill: "#8a8a8a", fillStyle: "solid" }))}
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
      ${multilineTextMarkup(label || "Titel", 8, imgH + 18, "#333333", 11.5, false, "start")}
      ${paths(sketchLine(8, imgH + 28, w - 24, imgH + 28, seedFor(shape.id, "l1"), { stroke: "#8a8a8a", strokeWidth: 2 }))}
    </g>`;
  }

  if (kind === "heading" || kind === "label") {
    return `<g transform="translate(${shape.position.x} ${shape.position.y})">${multilineTextMarkup(label || (kind === "heading" ? "Überschrift" : "Label"), w / 2, kind === "heading" ? h / 2 + 6 : h / 2 + 4, "#333333", kind === "heading" ? 20 : 12.5)}</g>`;
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
      ${paths(sketchPath(d, seed, { stroke, fill: "#fff8e0", fillStyle: "solid" }))}
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
      ${paths(sketchPath(d, seed, { stroke, fill: "#333333", fillStyle: "solid" }))}
      ${multilineTextMarkup(label || "Tooltip-Text", w / 2, bodyH / 2 + 4, "#ffffff", 11)}
    </g>`;
  }

  if (kind === "scrollbar") {
    const isVertical = h >= w;
    const thumbLength = (isVertical ? h : w) * 0.4;
    const thumb = isVertical
      ? paths(sketchRect(w - 4, thumbLength, seedFor(shape.id, "thumb"), { stroke, fill: "#8a8a8a", fillStyle: "solid" }))
      : paths(sketchRect(thumbLength, h - 4, seedFor(shape.id, "thumb"), { stroke, fill: "#8a8a8a", fillStyle: "solid" }));
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
        const header = `<g transform="translate(0 ${y})">${paths(sketchRect(w, HEADER_H, seedFor(shape.id, `hdr${i}`), { stroke, fill: "#f4f4f4" }))}${multilineTextMarkup(`${expanded ? "▾" : "▸"} ${section}`, 10, HEADER_H / 2 + 4, "#333333", 11, false, "start")}${expanded ? `<g transform="translate(0 ${HEADER_H})">${paths(sketchRect(w, bodyHeight, seedFor(shape.id, "body"), { stroke }))}</g>` : ""}</g>`;
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
        const text = multilineTextMarkup(item, x, h / 2 + 4, stroke, 11.5, false, "start");
        const chevron = !isLast ? multilineTextMarkup("›", x + item.length * 6.5 + 8, h / 2 + 4, stroke, 12, false, "start") : "";
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
      ${multilineTextMarkup(label || "TT.MM.JJJJ", 8, h / 2 + 4, "#999999", 11.5, false, "start")}
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
        return `<g transform="translate(${x} ${y})">${paths(sketchRect(barW, barH, seedFor(shape.id, `bar${i}`), { stroke, fill: "#8a8a8a", fillStyle: "solid" }))}</g>`;
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
    return `<g transform="translate(${shape.position.x} ${shape.position.y})">${paths(sketchSparkle(w / 2, h / 2, r, seed, { stroke, fill: "#f4f4f4", fillStyle: "solid" }))}</g>`;
  }

  // Fallback für unbekannte/zukünftige Wireframe-Typen: einfache skizzierte Box.
  return `<g transform="translate(${shape.position.x} ${shape.position.y})">
    ${paths(sketchRect(w, h, seed, { stroke, fill: "#ffffff" }))}
    ${label ? multilineTextMarkup(label, w / 2, h / 2 + 5, "#333333", 12) : ""}
  </g>`;
}
