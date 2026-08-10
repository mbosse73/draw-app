import rough from "roughjs";
import type { Options as RoughOptions } from "roughjs/bin/core";

/**
 * Gemeinsame Skizzen-Engine für das gesamte Wireframe-Modul. Löst das in der
 * technischen Doku (Abschnitt 4.5/7) dokumentierte "Export-Renderer-
 * Dreifachpflege"-Problem für dieses Modul: Statt die handgezeichnete Optik
 * pro Shape zweimal (Bildschirm-JSX + Export-String) neu zu erfinden, liefert
 * `rough.generator()` reine Pfad-DATEN (kein DOM/Canvas nötig, siehe
 * roughjs/bin/generator.d.ts), die sowohl `<SketchPaths>` (JSX, Bildschirm)
 * als auch `sketchPathsToSvgString()` (String, imageExport.ts) identisch
 * konsumieren. Die eigentliche "wie sieht das aus"-Logik existiert dadurch
 * nur EINMAL pro Shape-Typ (in den jeweiligen shapes/*.tsx-Dateien); nur die
 * Registrierung an den drei Stellen (Komponente/Export-Fallunterscheidung/
 * Toolbox-Icon) bleibt mechanisch dreifach - das war immer schon
 * unvermeidbar, aber jetzt trivial statt fehleranfällig.
 *
 * WICHTIG für Konsistenz: Derselbe `seed` liefert bei roughjs IMMER dieselbe
 * "Wackligkeit" zurück (kein Neu-Würfeln bei jedem Re-Render). Ohne festen,
 * aus der Shape-ID abgeleiteten Seed würde eine Form bei jeder Bewegung/
 * jedem Undo/Redo anders wackeln, was unruhig wirkt und außerdem dazu führen
 * würde, dass Bildschirm und Export nie exakt gleich aussehen.
 */

const generator = rough.generator();

export interface SketchPath {
  d: string;
  fill?: string;
  stroke: string;
  strokeWidth: number;
}

const DEFAULT_OPTIONS: RoughOptions = {
  roughness: 1.4,
  bowing: 1,
  strokeWidth: 1.4,
  disableMultiStroke: false,
};

function drawableToPaths(drawable: ReturnType<typeof generator.rectangle>): SketchPath[] {
  return generator.toPaths(drawable).map((p) => ({
    d: p.d,
    fill: p.fill,
    stroke: p.stroke,
    strokeWidth: p.strokeWidth,
  }));
}

/** Deterministischer Seed aus Shape-ID + optionalem Diskriminator (z.B. für
 *  mehrere unabhängig "gezeichnete" Teile derselben Shape, etwa Rahmen vs.
 *  Titelleiste eines Fensters - sonst hätten beide denselben Seed und würden
 *  identisch/unnatürlich parallel wackeln). */
export function seedFor(shapeId: string, discriminator = ""): number {
  const str = shapeId + "::" + discriminator;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 2147483647 || 1;
}

export function sketchRect(width: number, height: number, seed: number, options?: RoughOptions): SketchPath[] {
  return drawableToPaths(generator.rectangle(0, 0, width, height, { seed, ...DEFAULT_OPTIONS, ...options }));
}

/** Rechteck mit abgerundeten Ecken - der Balsamiq-typische "freundliche"
 *  Kontrollen-Look (Button/Feld/Fenster wirken wie gezeichnete UI-Controls,
 *  nicht wie technische CAD-Boxen). Über einen Pfad mit Bogen-Segmenten
 *  gebaut und durch generator.path() geschickt, damit roughjs seine übliche
 *  Wackel-Optik auch auf die Rundung anwendet (roughjs hat kein natives
 *  "rounded rectangle"-Primitiv). `radius` wird auf die halbe kürzere Seite
 *  begrenzt, damit kleine Elemente (Checkbox, Icon-Button) nicht entarten. */
export function sketchRoundedRect(width: number, height: number, seed: number, options?: RoughOptions, radius = 6): SketchPath[] {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  const d =
    r === 0
      ? `M 0 0 L ${width} 0 L ${width} ${height} L 0 ${height} Z`
      : `M ${r} 0 L ${width - r} 0 A ${r} ${r} 0 0 1 ${width} ${r} L ${width} ${height - r} A ${r} ${r} 0 0 1 ${width - r} ${height} L ${r} ${height} A ${r} ${r} 0 0 1 0 ${height - r} L 0 ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`;
  return drawableToPaths(generator.path(d, { seed, ...DEFAULT_OPTIONS, ...options }));
}

export function sketchLine(x1: number, y1: number, x2: number, y2: number, seed: number, options?: RoughOptions): SketchPath[] {
  return drawableToPaths(generator.line(x1, y1, x2, y2, { seed, ...DEFAULT_OPTIONS, ...options }));
}

export function sketchEllipse(cx: number, cy: number, width: number, height: number, seed: number, options?: RoughOptions): SketchPath[] {
  return drawableToPaths(generator.ellipse(cx, cy, width, height, { seed, ...DEFAULT_OPTIONS, ...options }));
}

export function sketchCircle(cx: number, cy: number, diameter: number, seed: number, options?: RoughOptions): SketchPath[] {
  return drawableToPaths(generator.circle(cx, cy, diameter, { seed, ...DEFAULT_OPTIONS, ...options }));
}

export function sketchPolygon(points: [number, number][], seed: number, options?: RoughOptions): SketchPath[] {
  return drawableToPaths(generator.polygon(points, { seed, ...DEFAULT_OPTIONS, ...options }));
}

export function sketchPath(d: string, seed: number, options?: RoughOptions): SketchPath[] {
  return drawableToPaths(generator.path(d, { seed, ...DEFAULT_OPTIONS, ...options }));
}

/** Generisches "Icon"-Platzhalter-Sinnbild: ein vierzackiger Stern/Funken,
 *  wie ihn auch Balsamiq für sein generisches Icon-Element nutzt. Geteilte
 *  Primitive statt Duplikat, da sowohl das echte Shape (DataDisplayShapes/
 *  ButtonShapes) als auch die Toolbox-Vorschau (ToolboxIcon) denselben
 *  Umriss brauchen. */
export function sketchSparkle(cx: number, cy: number, r: number, seed: number, options?: RoughOptions): SketchPath[] {
  const d = `M ${cx} ${cy - r} Q ${cx + r * 0.18} ${cy - r * 0.18} ${cx + r} ${cy} Q ${cx + r * 0.18} ${cy + r * 0.18} ${cx} ${cy + r} Q ${cx - r * 0.18} ${cy + r * 0.18} ${cx - r} ${cy} Q ${cx - r * 0.18} ${cy - r * 0.18} ${cx} ${cy - r} Z`;
  return drawableToPaths(generator.path(d, { seed, ...DEFAULT_OPTIONS, ...options }));
}

/** Für den String-Export (imageExport.ts) - dieselben SketchPath-Daten wie SketchPaths (JSX). */
export function sketchPathsToSvgString(paths: SketchPath[]): string {
  return paths
    .map(
      (p) =>
        `<path d="${p.d}" fill="${p.fill ?? "none"}" stroke="${p.stroke}" stroke-width="${p.strokeWidth}" />`
    )
    .join("");
}

/** Zerlegt mehrzeiligen Vorschau-Inhalt (data.items, newline-getrennt) - vom
 *  gemeinsamen Muster für Liste/Tabelle/Menüleiste/Baumansicht genutzt. */
export function parseItems(raw: unknown, fallback: string[]): string[] {
  if (typeof raw !== "string" || raw.trim() === "") return fallback;
  return raw.split("\n").map((line) => line.trimEnd());
}
