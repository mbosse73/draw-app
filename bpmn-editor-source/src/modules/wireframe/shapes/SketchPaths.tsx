import type { ShapeInstance } from "../../../core/shapes/types";
import { applySketchStyleOverride, type SketchPath } from "./sketch";

/** Rendert von sketch.ts erzeugte Pfad-Daten als SVG - der JSX-Konsument der gemeinsamen Skizzen-Engine.
 *  Optionales `transform` spart den sonst nötigen umschließenden `<g>` an Aufrufstellen, die eine Teilform
 *  (z.B. ein Detail-Icon innerhalb einer Toolbox-Vorschau) nur lokal verschieben wollen.
 *
 *  `shape` ist der einzige Punkt, an dem die Stil-Panel-Overrides (Z-15) in die
 *  Wireframe-Darstellung einfließen: Statt Füll- und Linienfarbe in allen 87
 *  Zeichenaufrufen der 42 Shape-Typen einzeln aufzulösen, geschieht das hier
 *  einmal zentral - und in `sketchPathsToSvgString()` identisch für den Export.
 *  Ohne `shape` (z.B. Toolbox-Vorschau) bleibt alles wie gezeichnet. */
export function SketchPaths({ paths, transform, shape }: { paths: SketchPath[]; transform?: string; shape?: ShapeInstance }) {
  const content = paths.map(applySketchStyleOverride(shape)).map((p, i) => (
    <path key={i} d={p.d} fill={p.fill ?? "none"} stroke={p.stroke} strokeWidth={p.strokeWidth} />
  ));
  return transform ? <g transform={transform}>{content}</g> : <>{content}</>;
}
