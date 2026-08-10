import type { SketchPath } from "./sketch";

/** Rendert von sketch.ts erzeugte Pfad-Daten als SVG - der JSX-Konsument der gemeinsamen Skizzen-Engine.
 *  Optionales `transform` spart den sonst nötigen umschließenden `<g>` an Aufrufstellen, die eine Teilform
 *  (z.B. ein Detail-Icon innerhalb einer Toolbox-Vorschau) nur lokal verschieben wollen. */
export function SketchPaths({ paths, transform }: { paths: SketchPath[]; transform?: string }) {
  const content = paths.map((p, i) => <path key={i} d={p.d} fill={p.fill ?? "none"} stroke={p.stroke} strokeWidth={p.strokeWidth} />);
  return transform ? <g transform={transform}>{content}</g> : <>{content}</>;
}
