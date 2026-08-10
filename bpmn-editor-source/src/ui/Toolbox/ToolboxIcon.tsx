import { SketchPaths } from "../../modules/wireframe/shapes/SketchPaths";
import { sketchRect, sketchRoundedRect, sketchLine, sketchCircle, sketchPath, sketchSparkle, seedFor } from "../../modules/wireframe/shapes/sketch";
import { MultilineText } from "../../core/canvas/MultilineText";

const SIZE = 28;

/**
 * Erzeugt eine kleine SVG-Vorschau für die Toolbox, die optisch der echten
 * Zeichenfläche-Form entspricht (Kreis für Events, Raute für Gateways, etc.).
 * Bewusst als eigenständige, leichte Vorschau getrennt vom echten Shape-Renderer,
 * da die Toolbox-Kachel andere Proportionen (klein, fix, ohne Ports) braucht.
 *
 * Wireframe-Icons nutzen bewusst dieselbe sketch.ts-Engine wie die echten
 * Shapes (statt cleaner Linien) - sonst würde die Toolbox-Vorschau nicht zur
 * handskizzierten Optik auf der Zeichenfläche passen.
 *
 * WICHTIG (behobener Dunkelmodus-Bug): Jedes Icon bekommt hier IMMER dieselbe
 * helle "Canvas"-Hintergrundplatte (--canvas-bg), unabhängig vom App-Theme.
 * Grund: Die Zeichenfläche selbst bleibt bewusst in beiden Themes papierhell
 * (siehe App.css-Kommentar zu --canvas-bg) - ein Icon soll genau zeigen, wie
 * das Element AUF DER ZEICHENFLÄCHE aussieht, nicht auf der (im Dunkelmodus
 * dunklen) Toolbox-Chrome. Vorher hatten viele Wireframe-Icons gar keine
 * eigene Füllung (nur Kontur) und wurden dadurch im Dunkelmodus mit ihrer
 * dunklen Kontur auf dunklem Grund praktisch unsichtbar.
 */
export function ToolboxIcon({ shapeType }: { shapeType: string }) {
  return (
    <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
      <rect width={SIZE} height={SIZE} rx={5} fill="var(--canvas-bg, #eef1f6)" />
      <IconGlyph shapeType={shapeType} />
    </svg>
  );
}

function IconGlyph({ shapeType }: { shapeType: string }) {
  const stroke = "#454d5a";

  if (shapeType.startsWith("wireframe.")) {
    const wfStroke = "#4a4a4a";
    const seed = seedFor(shapeType);
    const kind = shapeType.slice("wireframe.".length);

    // Kleiner Chevron (Pfeilspitze, z.B. Dropdown/Spinner) - eigenständige
    // Mini-Komponente, da mehrere Icons unten dieselbe Geste brauchen.
    function Chevron({ cx, cy, size, dir = "down" }: { cx: number; cy: number; size: number; dir?: "down" | "up" }) {
      const dy = dir === "down" ? size : -size;
      return (
        <SketchPaths
          paths={sketchPath(`M ${cx - size} ${cy - dy / 2} L ${cx} ${cy + dy / 2} L ${cx + size} ${cy - dy / 2}`, seedFor(shapeType, `chev-${dir}`), { stroke: wfStroke })}
        />
      );
    }

    if (kind === "window" || kind === "dialog") {
      return (
        <g transform="translate(2 5)">
          <SketchPaths paths={sketchRoundedRect(24, 18, seed, { stroke: wfStroke }, 3)} />
          <SketchPaths paths={sketchLine(0, 6, 24, 6, seedFor(shapeType, "bar"), { stroke: wfStroke })} />
          <SketchPaths paths={sketchCircle(4.5, 3, 3, seedFor(shapeType, "sys"), { stroke: wfStroke })} />
        </g>
      );
    }
    if (kind === "messageBox") {
      return (
        <g transform="translate(2 5)">
          <SketchPaths paths={sketchRoundedRect(24, 18, seed, { stroke: wfStroke }, 3)} />
          <SketchPaths paths={sketchCircle(7, 9, 9, seedFor(shapeType, "icon"), { stroke: wfStroke, roughness: 0.7 })} />
          <SketchPaths paths={sketchLine(7, 5.5, 7, 10, seedFor(shapeType, "bang1"), { stroke: wfStroke, strokeWidth: 2, roughness: 0.6 })} />
          <SketchPaths paths={sketchCircle(7, 12.5, 1.8, seedFor(shapeType, "bang2"), { stroke: wfStroke, fill: wfStroke, fillStyle: "solid", roughness: 0.4 })} />
          <SketchPaths paths={sketchRoundedRect(9, 7, seedFor(shapeType, "ok"), { stroke: wfStroke, roughness: 0.7 }, 2)} transform="translate(13 11)" />
        </g>
      );
    }
    if (kind === "panel") {
      return (
        <g transform="translate(2 7)">
          <SketchPaths paths={sketchRoundedRect(24, 15, seed, { stroke: wfStroke }, 3)} />
          <SketchPaths paths={sketchRect(9, 5, seedFor(shapeType, "tab"), { stroke: wfStroke, fill: "var(--canvas-bg, #eef1f6)", fillStyle: "solid" })} transform="translate(3 -3)" />
        </g>
      );
    }
    if (kind === "tabContainer") {
      return (
        <g transform="translate(2 5)">
          {[0, 1, 2].map((i) => (
            <SketchPaths key={i} paths={sketchRect(7, 5, seedFor(shapeType, `tab${i}`), { stroke: wfStroke, fill: i === 0 ? "#ffffff" : "var(--canvas-bg, #eef1f6)", fillStyle: "solid" })} transform={`translate(${i * 7.3} 0)`} />
          ))}
          <SketchPaths paths={sketchRect(24, 13, seedFor(shapeType, "body"), { stroke: wfStroke })} transform="translate(0 5)" />
        </g>
      );
    }
    if (kind === "splitter") {
      return (
        <>
          <SketchPaths paths={sketchLine(14, 3, 14, 25, seed, { stroke: wfStroke, strokeWidth: 1.6 })} />
          <Chevron cx={9} cy={14} size={2.5} dir="down" />
          <Chevron cx={19} cy={14} size={2.5} dir="up" />
        </>
      );
    }
    if (kind === "statusBar") {
      return (
        <g transform="translate(2 18)">
          <SketchPaths paths={sketchRect(24, 7, seed, { stroke: wfStroke, fill: "#f4f4f4", fillStyle: "solid" })} />
          <SketchPaths paths={sketchLine(3, 3.5, 13, 3.5, seedFor(shapeType, "txt"), { stroke: wfStroke, strokeWidth: 1.2 })} />
          <SketchPaths paths={sketchRect(4, 4, seedFor(shapeType, "icn"), { stroke: wfStroke })} transform="translate(18 1.5)" />
        </g>
      );
    }
    if (kind === "scrollbar") {
      return (
        <g transform="translate(11 2)">
          <SketchPaths paths={sketchRect(6, 24, seed, { stroke: wfStroke, fill: "#f4f4f4", fillStyle: "solid" })} />
          <SketchPaths paths={sketchRect(4, 9, seedFor(shapeType, "thumb"), { stroke: wfStroke, fill: "#8a8a8a", fillStyle: "solid" })} transform="translate(1 4)" />
        </g>
      );
    }
    if (kind === "accordion") {
      return (
        <g transform="translate(2 1)">
          <SketchPaths paths={sketchRect(24, 8, seed, { stroke: wfStroke, fill: "#f4f4f4", fillStyle: "solid" })} />
          <Chevron cx={5} cy={4} size={2} dir="down" />
          <SketchPaths paths={sketchLine(10, 4, 20, 4, seedFor(shapeType, "t1"), { stroke: wfStroke, strokeWidth: 1.1 })} />
          <SketchPaths paths={sketchRect(24, 9, seedFor(shapeType, "body"), { stroke: wfStroke })} transform="translate(0 8)" />
          <SketchPaths paths={sketchRect(24, 8, seedFor(shapeType, "hdr2"), { stroke: wfStroke, fill: "#f4f4f4", fillStyle: "solid" })} transform="translate(0 17)" />
          <Chevron cx={5} cy={21} size={2} dir="down" />
        </g>
      );
    }
    if (kind === "menuBar") {
      return (
        <g transform="translate(2 10)">
          <SketchPaths paths={sketchRect(24, 8, seed, { stroke: wfStroke, fill: "#f4f4f4", fillStyle: "solid" })} />
          {[3, 10, 17].map((x, i) => (
            <SketchPaths key={i} paths={sketchLine(x, 4, x + 4.5, 4, seedFor(shapeType, `w${i}`), { stroke: wfStroke, strokeWidth: 1.1 })} />
          ))}
        </g>
      );
    }
    if (kind === "dropdownMenu") {
      return (
        <g transform="translate(3 4)">
          <SketchPaths paths={sketchRoundedRect(22, 20, seed, { stroke: wfStroke, fill: "#ffffff" }, 2)} />
          <SketchPaths paths={sketchRect(20, 6, seedFor(shapeType, "sel"), { stroke: wfStroke, fill: "#e3e6ea", fillStyle: "solid" })} transform="translate(1 7)" />
          {[3, 10, 17].map((y, i) => (
            <SketchPaths key={i} paths={sketchLine(3, y, 17, y, seedFor(shapeType, `r${i}`), { stroke: wfStroke, strokeWidth: 1.1 })} />
          ))}
        </g>
      );
    }
    if (kind === "toolbar") {
      return (
        <g transform="translate(2 9)">
          <SketchPaths paths={sketchRect(24, 10, seed, { stroke: wfStroke, fill: "#f4f4f4", fillStyle: "solid" })} />
          {[0, 1, 2].map((i) => (
            <SketchPaths key={i} paths={sketchRect(6, 6, seedFor(shapeType, `b${i}`), { stroke: wfStroke })} transform={`translate(${2 + i * 8} 2)`} />
          ))}
        </g>
      );
    }
    if (kind === "ribbon") {
      return (
        <g transform="translate(2 4)">
          <SketchPaths paths={sketchRect(24, 20, seed, { stroke: wfStroke, fill: "#f4f4f4", fillStyle: "solid" })} />
          {[0, 1].map((g) => (
            <g key={g} transform={`translate(${2 + g * 13} 3)`}>
              <SketchPaths paths={sketchRect(6, 6, seedFor(shapeType, `${g}a`), { stroke: wfStroke })} />
              <SketchPaths paths={sketchRect(6, 6, seedFor(shapeType, `${g}b`), { stroke: wfStroke })} transform="translate(0 8)" />
            </g>
          ))}
          <SketchPaths paths={sketchLine(11, 2, 11, 17, seedFor(shapeType, "sep"), { stroke: wfStroke, strokeWidth: 0.8 })} />
        </g>
      );
    }
    if (kind === "breadcrumb") {
      return (
        <g transform="translate(1 14)">
          <SketchPaths paths={sketchLine(0, 0, 6, 0, seed, { stroke: wfStroke, strokeWidth: 1.4 })} />
          <MultilineText text="›" x={9} y={3} fontSize={9} fill={wfStroke} />
          <SketchPaths paths={sketchLine(13, 0, 20, 0, seedFor(shapeType, "b"), { stroke: wfStroke, strokeWidth: 1.4 })} />
          <MultilineText text="›" x={22.5} y={3} fontSize={9} fill={wfStroke} />
          <SketchPaths paths={sketchLine(25, 0, 26, 0, seedFor(shapeType, "c"), { stroke: wfStroke, strokeWidth: 2.2 })} />
        </g>
      );
    }
    if (kind === "textField") {
      return (
        <g transform="translate(3 8)">
          <SketchPaths paths={sketchRoundedRect(22, 12, seed, { stroke: wfStroke, fill: "#ffffff" }, 2.5)} />
          <SketchPaths paths={sketchLine(4, 3, 4, 9, seedFor(shapeType, "cursor"), { stroke: wfStroke, strokeWidth: 1.4 })} />
          <SketchPaths paths={sketchLine(8, 6, 17, 6, seedFor(shapeType, "ph"), { stroke: "#bbbbbb", strokeWidth: 1.6 })} />
        </g>
      );
    }
    if (kind === "textArea") {
      return (
        <g transform="translate(3 5)">
          <SketchPaths paths={sketchRoundedRect(22, 18, seed, { stroke: wfStroke, fill: "#ffffff" }, 2.5)} />
          {[5, 9.5, 14].map((y, i) => (
            <SketchPaths key={i} paths={sketchLine(3, y, i === 2 ? 13 : 19, y, seedFor(shapeType, `l${i}`), { stroke: "#bbbbbb", strokeWidth: 1.6 })} />
          ))}
        </g>
      );
    }
    if (kind === "checkbox") {
      return (
        <g transform="translate(6 9)">
          <SketchPaths paths={sketchRoundedRect(11, 11, seed, { stroke: wfStroke }, 1.5)} />
          <SketchPaths paths={sketchLine(2, 6, 4.5, 9, seedFor(shapeType, "ck1"), { stroke: wfStroke, strokeWidth: 1.6 })} />
          <SketchPaths paths={sketchLine(4.5, 9, 9, 2, seedFor(shapeType, "ck2"), { stroke: wfStroke, strokeWidth: 1.6 })} />
        </g>
      );
    }
    if (kind === "radio") {
      return (
        <g transform="translate(6 6)">
          <SketchPaths paths={sketchCircle(8, 8, 16, seed, { stroke: wfStroke })} />
          <SketchPaths paths={sketchCircle(8, 8, 6, seedFor(shapeType, "dot"), { stroke: wfStroke, fill: wfStroke, fillStyle: "solid", roughness: 0.4 })} />
        </g>
      );
    }
    if (kind === "combobox") {
      return (
        <g transform="translate(3 8)">
          <SketchPaths paths={sketchRoundedRect(22, 12, seed, { stroke: wfStroke, fill: "#ffffff" }, 2.5)} />
          <SketchPaths paths={sketchLine(4, 6, 13, 6, seedFor(shapeType, "ph"), { stroke: "#bbbbbb", strokeWidth: 1.6 })} />
          <SketchPaths paths={sketchLine(16, 5, 18, 8, seedFor(shapeType, "c1"), { stroke: wfStroke })} />
          <SketchPaths paths={sketchLine(18, 8, 20, 5, seedFor(shapeType, "c2"), { stroke: wfStroke })} />
        </g>
      );
    }
    if (kind === "slider") {
      return (
        <>
          <SketchPaths paths={sketchLine(4, 14, 24, 14, seed, { stroke: wfStroke, strokeWidth: 1.6 })} />
          <SketchPaths paths={sketchCircle(16, 14, 8, seedFor(shapeType, "h"), { stroke: wfStroke, fill: "#fff" })} />
        </>
      );
    }
    if (kind === "spinner") {
      return (
        <g transform="translate(2 8)">
          <SketchPaths paths={sketchRoundedRect(22, 12, seed, { stroke: wfStroke, fill: "#ffffff" }, 2.5)} />
          <MultilineText text="0" x={7} y={9.5} fontSize={9} fill={wfStroke} />
          <SketchPaths paths={sketchLine(16, 0, 16, 12, seedFor(shapeType, "div"), { stroke: wfStroke, strokeWidth: 0.8 })} />
          <SketchPaths paths={sketchPath(`M 17.5 5.5 L 19 3.5 L 20.5 5.5`, seedFor(shapeType, "up"), { stroke: wfStroke })} />
          <SketchPaths paths={sketchPath(`M 17.5 6.5 L 19 8.5 L 20.5 6.5`, seedFor(shapeType, "down"), { stroke: wfStroke })} />
        </g>
      );
    }
    if (kind === "searchField") {
      return (
        <g transform="translate(2 8)">
          <SketchPaths paths={sketchRoundedRect(24, 12, seed, { stroke: wfStroke, fill: "#ffffff" }, 6)} />
          <SketchPaths paths={sketchCircle(8, 6, 6, seedFor(shapeType, "lens"), { stroke: wfStroke })} />
          <SketchPaths paths={sketchLine(10.5, 8.5, 12.5, 10.5, seedFor(shapeType, "handle"), { stroke: wfStroke, strokeWidth: 1.6 })} />
          <SketchPaths paths={sketchLine(17, 6, 21, 6, seedFor(shapeType, "ph"), { stroke: "#bbbbbb", strokeWidth: 1.6 })} />
        </g>
      );
    }
    if (kind === "datePicker") {
      return (
        <g transform="translate(2 6)">
          <SketchPaths paths={sketchRoundedRect(24, 14, seed, { stroke: wfStroke, fill: "#ffffff" }, 2.5)} />
          <SketchPaths paths={sketchLine(4, 4, 12, 4, seedFor(shapeType, "ph"), { stroke: "#bbbbbb", strokeWidth: 1.6 })} />
          <g transform="translate(15 2)">
            <SketchPaths paths={sketchRect(7, 8, seedFor(shapeType, "cal"), { stroke: wfStroke, fill: "#ffffff" })} />
            <SketchPaths paths={sketchLine(0, 2.5, 7, 2.5, seedFor(shapeType, "calbar"), { stroke: wfStroke, strokeWidth: 0.8 })} />
            <SketchPaths paths={sketchLine(2, 0, 2, 1.5, seedFor(shapeType, "ring1"), { stroke: wfStroke, strokeWidth: 1 })} />
            <SketchPaths paths={sketchLine(5, 0, 5, 1.5, seedFor(shapeType, "ring2"), { stroke: wfStroke, strokeWidth: 1 })} />
          </g>
        </g>
      );
    }
    if (kind === "button") {
      return (
        <g transform="translate(2 8)">
          <SketchPaths paths={sketchRoundedRect(24, 13, seed, { stroke: wfStroke, strokeWidth: 2, fill: "#f4f4f4", fillStyle: "solid" }, 5)} />
          <SketchPaths paths={sketchLine(9, 6.5, 19, 6.5, seedFor(shapeType, "label"), { stroke: wfStroke, strokeWidth: 1.8 })} />
        </g>
      );
    }
    if (kind === "iconButton") {
      return (
        <g transform="translate(6 6)">
          <SketchPaths paths={sketchRoundedRect(16, 16, seed, { stroke: wfStroke, fill: "#ffffff" }, 3)} />
          <SketchPaths paths={sketchSparkle(8, 8, 5, seedFor(shapeType, "spark"), { stroke: wfStroke, fill: "#e3e6ea", fillStyle: "solid" })} />
        </g>
      );
    }
    if (kind === "toggleSwitch") {
      return (
        <g transform="translate(3 9)">
          <SketchPaths paths={sketchRoundedRect(22, 10, seed, { stroke: wfStroke, fill: "#e3e6ea", fillStyle: "solid" }, 5)} />
          <SketchPaths paths={sketchCircle(17, 5, 8, seedFor(shapeType, "handle"), { stroke: wfStroke, fill: "#ffffff", fillStyle: "solid" })} />
        </g>
      );
    }
    if (kind === "segmentedControl") {
      return (
        <g transform="translate(2 9)">
          <SketchPaths paths={sketchRoundedRect(24, 10, seed, { stroke: wfStroke, fill: "#ffffff" }, 2.5)} />
          <SketchPaths paths={sketchRect(11, 8, seedFor(shapeType, "sel"), { stroke: wfStroke, fill: "#e3e6ea", fillStyle: "solid" })} transform="translate(12 1)" />
          <SketchPaths paths={sketchLine(12, 0, 12, 10, seedFor(shapeType, "div"), { stroke: wfStroke, strokeWidth: 1 })} />
        </g>
      );
    }
    if (kind === "list") {
      return (
        <g transform="translate(2 4)">
          <SketchPaths paths={sketchRect(24, 20, seed, { stroke: wfStroke, fill: "#ffffff" })} />
          {[4, 10, 16].map((y, i) => (
            <g key={i}>
              <SketchPaths paths={sketchCircle(4.5, y, 2.4, seedFor(shapeType, `d${i}`), { stroke: wfStroke, fill: wfStroke, fillStyle: "solid", roughness: 0.4 })} />
              <SketchPaths paths={sketchLine(8, y, 20, y, seedFor(shapeType, `t${i}`), { stroke: wfStroke, strokeWidth: 1.1 })} />
            </g>
          ))}
        </g>
      );
    }
    if (kind === "table") {
      return (
        <g transform="translate(2 4)">
          <SketchPaths paths={sketchRect(24, 20, seed, { stroke: wfStroke, fill: "#ffffff" })} />
          <SketchPaths paths={sketchRect(24, 6, seedFor(shapeType, "hdr"), { stroke: wfStroke, fill: "#e3e6ea", fillStyle: "solid" })} />
          <SketchPaths paths={sketchLine(8, 0, 8, 20, seedFor(shapeType, "c1"), { stroke: wfStroke, strokeWidth: 0.9 })} />
          <SketchPaths paths={sketchLine(16, 0, 16, 20, seedFor(shapeType, "c2"), { stroke: wfStroke, strokeWidth: 0.9 })} />
          <SketchPaths paths={sketchLine(0, 13, 24, 13, seedFor(shapeType, "r1"), { stroke: wfStroke, strokeWidth: 0.7 })} />
        </g>
      );
    }
    if (kind === "tree") {
      // Klassisches Hierarchie-Sinnbild (Stamm + Äste + Knoten) statt winziger
      // Chevrons/Einrückungs-Zeilen, die bei 28px kaum lesbar waren.
      return (
        <g transform="translate(2 4)">
          <SketchPaths paths={sketchRect(24, 20, seed, { stroke: wfStroke, fill: "#ffffff" })} />
          <SketchPaths paths={sketchLine(5, 3, 5, 17, seedFor(shapeType, "trunk"), { stroke: wfStroke, strokeWidth: 1.3, roughness: 0.7 })} />
          {[3, 10, 17].map((y, i) => (
            <g key={i}>
              <SketchPaths paths={sketchLine(5, y, 9, y, seedFor(shapeType, `b${i}`), { stroke: wfStroke, strokeWidth: 1.3, roughness: 0.7 })} />
              <SketchPaths paths={sketchCircle(5, y, 2.4, seedFor(shapeType, `n${i}`), { stroke: wfStroke, fill: "#ffffff", fillStyle: "solid", roughness: 0.5 })} />
              <SketchPaths paths={sketchLine(11, y, 21, y, seedFor(shapeType, `t${i}`), { stroke: wfStroke, strokeWidth: 1.4 })} />
            </g>
          ))}
        </g>
      );
    }
    if (kind === "progressBar") {
      return (
        <g transform="translate(2 11)">
          <SketchPaths paths={sketchRect(24, 6, seed, { stroke: wfStroke })} />
          <SketchPaths paths={sketchRect(14, 6, seedFor(shapeType, "fill"), { stroke: wfStroke, fill: "#8a8a8a", fillStyle: "solid" })} />
        </g>
      );
    }
    if (kind === "imagePlaceholder") {
      return (
        <g transform="translate(2 5)">
          <SketchPaths paths={sketchRoundedRect(24, 18, seed, { stroke: wfStroke }, 2)} />
          <SketchPaths paths={sketchCircle(18, 5.5, 4, seedFor(shapeType, "sun"), { stroke: wfStroke })} />
          <SketchPaths paths={sketchLine(2, 14, 9, 6, seedFor(shapeType, "m1"), { stroke: wfStroke })} />
          <SketchPaths paths={sketchLine(9, 6, 15, 11, seedFor(shapeType, "m2"), { stroke: wfStroke })} />
          <SketchPaths paths={sketchLine(15, 11, 22, 4, seedFor(shapeType, "m3"), { stroke: wfStroke })} />
        </g>
      );
    }
    if (kind === "card") {
      return (
        <g transform="translate(3 2)">
          <SketchPaths paths={sketchRoundedRect(22, 24, seed, { stroke: wfStroke, fill: "#ffffff" }, 2.5)} />
          <SketchPaths paths={sketchRect(18, 12, seedFor(shapeType, "img"), { stroke: wfStroke })} transform="translate(2 2)" />
          <SketchPaths paths={sketchLine(3, 19, 15, 19, seedFor(shapeType, "title"), { stroke: wfStroke, strokeWidth: 1.4 })} />
          <SketchPaths paths={sketchLine(3, 22, 11, 22, seedFor(shapeType, "sub"), { stroke: "#bbbbbb", strokeWidth: 1.2 })} />
        </g>
      );
    }
    if (kind === "chart") {
      return (
        <g transform="translate(2 4)">
          <SketchPaths paths={sketchRect(24, 20, seed, { stroke: wfStroke, fill: "#ffffff" })} />
          {[0.4, 0.8, 0.55, 0.95].map((ratio, i) => {
            const barH = 15 * ratio;
            return <SketchPaths key={i} paths={sketchRect(4, barH, seedFor(shapeType, `bar${i}`), { stroke: wfStroke, fill: "#8a8a8a", fillStyle: "solid" })} transform={`translate(${3 + i * 5} ${17 - barH})`} />;
          })}
        </g>
      );
    }
    if (kind === "icon") {
      return <SketchPaths paths={sketchSparkle(14, 14, 10, seed, { stroke: wfStroke, fill: "#e3e6ea", fillStyle: "solid" })} />;
    }
    if (kind === "heading" || kind === "label" || kind === "link") {
      return (
        <>
          <SketchPaths paths={sketchLine(4, 12, 24, 12, seed, { stroke: wfStroke, strokeWidth: kind === "heading" ? 2.6 : 1.6 })} />
          {kind === "link" && <SketchPaths paths={sketchLine(4, 17, 24, 17, seedFor(shapeType, "u"), { stroke: wfStroke, strokeWidth: 1 })} />}
        </>
      );
    }
    if (kind === "paragraph") {
      return (
        <>
          {[7, 13, 19].map((y, i) => (
            <SketchPaths key={i} paths={sketchLine(3, y, i === 2 ? 16 : 25, y, seedFor(shapeType, `l${i}`), { stroke: wfStroke, strokeWidth: 2 })} />
          ))}
        </>
      );
    }
    if (kind === "commentBubble") {
      const w = 22, h = 15, tailW = 5;
      const d = `M 1 1 L ${w - 1} 1 L ${w - 1} ${h - 1} L ${tailW * 2} ${h - 1} L ${tailW} ${h + 5} L ${tailW} ${h - 1} L 1 ${h - 1} Z`;
      return (
        <g transform="translate(3 4)">
          <SketchPaths paths={sketchPath(d, seed, { stroke: wfStroke, fill: "#fff8e0", fillStyle: "solid" })} />
        </g>
      );
    }
    if (kind === "highlightBox") {
      return (
        <g transform="translate(2 5)">
          <SketchPaths paths={sketchRoundedRect(24, 18, seed, { stroke: "#c0392b", strokeLineDash: [4, 3] }, 2)} />
        </g>
      );
    }
    if (kind === "tooltip") {
      const w = 22, h = 12, tailW = 4;
      const d = `M 1 1 L ${w - 1} 1 L ${w - 1} ${h - 1} L ${w / 2 + tailW} ${h - 1} L ${w / 2} ${h + 5} L ${w / 2 - tailW} ${h - 1} L 1 ${h - 1} Z`;
      return (
        <g transform="translate(3 3)">
          <SketchPaths paths={sketchPath(d, seed, { stroke: wfStroke, fill: "#333333", fillStyle: "solid" })} />
          <SketchPaths paths={sketchLine(6, 6, 16, 6, seedFor(shapeType, "txt"), { stroke: "#ffffff", strokeWidth: 1.4 })} />
        </g>
      );
    }
    // Generischer Fallback - sollte für keinen registrierten Wireframe-Typ
    // mehr greifen (jeder Typ oben hat ein eigenes Sinnbild); bleibt nur als
    // Sicherheitsnetz für künftige, noch nicht mit einem Icon versehene Typen.
    return (
      <g transform="translate(2 6)">
        <SketchPaths paths={sketchRoundedRect(24, 16, seed, { stroke: wfStroke }, 3)} />
      </g>
    );
  }

  // Kleines Trigger-Symbol (Uhr/Umschlag/Blitz), wiederverwendet für normale
  // und Boundary-Events. Erkennt den Trigger-Teil am Ende des Typ-Strings,
  // z.B. "bpmn.event.start.timer" -> "timer", "bpmn.boundaryEvent.error" -> "error".
  function TriggerMark({ trigger, cx, cy }: { trigger: string | undefined; cx: number; cy: number }) {
    if (trigger === "timer") {
      return (
        <g stroke={stroke} strokeWidth={1} fill="none">
          <circle cx={cx} cy={cy} r={4.5} />
          <line x1={cx} y1={cy} x2={cx} y2={cy - 2.8} />
          <line x1={cx} y1={cy} x2={cx + 2} y2={cy} />
        </g>
      );
    }
    if (trigger === "message") {
      return (
        <g stroke={stroke} strokeWidth={0.9} fill="none">
          <rect x={cx - 4} y={cy - 2.6} width={8} height={5.2} />
          <path d={`M ${cx - 4} ${cy - 2.6} L ${cx} ${cy} L ${cx + 4} ${cy - 2.6}`} />
        </g>
      );
    }
    if (trigger === "error") {
      return (
        <path
          d={`M ${cx - 3} ${cy + 4} L ${cx - 0.5} ${cy - 1} L ${cx + 1.3} ${cy + 1.3} L ${cx + 3.5} ${cy - 4.5}`}
          stroke={stroke}
          strokeWidth={1.2}
          fill="none"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      );
    }
    return null;
  }

  // Normale Events: bpmn.event.<kind> oder bpmn.event.<kind>.<trigger>
  if (shapeType.startsWith("bpmn.event.")) {
    const parts = shapeType.split(".");
    const kind = parts[2]; // "start" | "intermediate" | "end"
    const trigger = parts[3]; // "timer" | "message" | "error" | undefined
    const isEnd = kind === "end";
    const isIntermediate = kind === "intermediate";
    return (
      <>
        <circle cx={14} cy={14} r={isEnd ? 10.5 : 11} fill="#fff" stroke={stroke} strokeWidth={isEnd ? 3 : 1.8} />
        {isIntermediate && <circle cx={14} cy={14} r={7.5} fill="none" stroke={stroke} strokeWidth={1.3} />}
        <TriggerMark trigger={trigger} cx={14} cy={14} />
      </>
    );
  }

  // Boundary Events: bpmn.boundaryEvent.<trigger> - Doppelkreis wie am Task-Rand
  if (shapeType.startsWith("bpmn.boundaryEvent.")) {
    const trigger = shapeType.split(".")[1];
    return (
      <>
        <circle cx={14} cy={14} r={10.5} fill="#fff" stroke={stroke} strokeWidth={1.6} />
        <circle cx={14} cy={14} r={7.5} fill="none" stroke={stroke} strokeWidth={1} />
        <TriggerMark trigger={trigger} cx={14} cy={14} />
      </>
    );
  }

  if (shapeType.startsWith("bpmn.task.")) {
    const isPlain = shapeType === "bpmn.task.none";
    return (
      <>
        <rect x={2} y={5} width={24} height={18} rx={3.5} fill="#f5f8fc" stroke={stroke} strokeWidth={1.5} />
        {!isPlain && <line x1={6} y1={9} x2={12} y2={9} stroke={stroke} strokeWidth={1.2} opacity={0.6} />}
      </>
    );
  }

  // Sub-Prozess: wie ein Task, aber mit kleinem +/- Symbol unten mittig als Hinweis
  if (shapeType === "bpmn.subProcess") {
    return (
      <>
        <rect x={2} y={5} width={24} height={18} rx={3.5} fill="#f5f8fc" stroke={stroke} strokeWidth={1.5} />
        <rect x={11} y={17} width={6} height={6} rx={1} fill="#fff" stroke={stroke} strokeWidth={1} />
        <line x1={12.5} y1={20} x2={15.5} y2={20} stroke={stroke} strokeWidth={1} />
        <line x1={14} y1={18.5} x2={14} y2={21.5} stroke={stroke} strokeWidth={1} />
      </>
    );
  }

  if (shapeType.startsWith("bpmn.gateway.")) {
    const kind = shapeType.split(".").pop();
    return (
      <>
        <polygon points="14,2 26,14 14,26 2,14" fill="#fff" stroke={stroke} strokeWidth={1.5} />
        {kind === "exclusive" && (
          <g stroke={stroke} strokeWidth={2}>
            <line x1={10.5} y1={10.5} x2={17.5} y2={17.5} />
            <line x1={17.5} y1={10.5} x2={10.5} y2={17.5} />
          </g>
        )}
        {kind === "parallel" && (
          <g stroke={stroke} strokeWidth={2}>
            <line x1={14} y1={9} x2={14} y2={19} />
            <line x1={9} y1={14} x2={19} y2={14} />
          </g>
        )}
        {kind === "inclusive" && <circle cx={14} cy={14} r={5} fill="none" stroke={stroke} strokeWidth={2} />}
        {/* kind === "none": bewusst kein Symbol - einfaches Gateway */}
      </>
    );
  }

  if (shapeType === "bpmn.dataObject") {
    return (
      <>
        <path d="M 6 3 L 18 3 L 22 7 L 22 25 L 6 25 Z" fill="#fff" stroke={stroke} strokeWidth={1.5} />
        <path d="M 18 3 L 18 7 L 22 7" fill="none" stroke={stroke} strokeWidth={1.5} />
      </>
    );
  }

  // Pool UND Lane: beide sind Container mit seitlichem Titel-Band.
  if (shapeType === "bpmn.pool" || shapeType === "bpmn.lane") {
    return (
      <>
        <rect x={2} y={4} width={24} height={20} fill="#fff" stroke={stroke} strokeWidth={1.5} />
        <line x1={8} y1={4} x2={8} y2={24} stroke={stroke} strokeWidth={1.5} />
      </>
    );
  }

  // Text-Element: Buchstabe "T" als Platzhalter-Symbol, deutet freien Text an
  if (shapeType === "text.label") {
    return (
      <>
        <line x1={7} y1={7} x2={21} y2={7} stroke={stroke} strokeWidth={1.8} />
        <line x1={14} y1={7} x2={14} y2={21} stroke={stroke} strokeWidth={1.8} />
      </>
    );
  }

  // Fallback: einfaches Rechteck
  return <rect x={3} y={6} width={22} height={16} rx={2} fill="#fff" stroke={stroke} strokeWidth={1.5} />;
}
