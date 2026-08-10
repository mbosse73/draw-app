import type { ShapeInstance } from "./types";

/**
 * Generische Auflösung der Stil-Panel-Overrides (ShapeStyle) gegen einen
 * modul-eigenen Default.
 *
 * Diese Helfer lagen ursprünglich in `modules/bpmn/shapes/constants.ts`,
 * enthalten aber keinerlei BPMN-Wissen - sie lesen ausschließlich
 * `shape.style`. Weil auch `core/io/imageExport.ts` sie braucht (damit der
 * Export dieselben Farben zeichnet wie der Bildschirm), gehören sie in den
 * Core: sonst müsste der Core aus einem Modul importieren, was die
 * Core/Plugin-Trennung verletzt.
 *
 * `modules/bpmn/shapes/constants.ts` re-exportiert sie unverändert weiter,
 * damit die bestehenden Modul-Imports gültig bleiben.
 */

export function resolveFill(shape: ShapeInstance, fallback: string): string {
  return shape.style?.fillColor ?? fallback;
}

export function resolveStroke(shape: ShapeInstance, fallback: string): string {
  return shape.style?.strokeColor ?? fallback;
}

export function resolveStrokeWidth(shape: ShapeInstance, fallback: number): number {
  return shape.style?.strokeWidth ?? fallback;
}

export function resolveDashArray(shape: ShapeInstance, fallback?: string): string | undefined {
  const dashStyle = shape.style?.dashStyle;
  if (dashStyle === "dashed") return "8 5";
  if (dashStyle === "dotted") return "2 3";
  if (dashStyle === "solid") return undefined;
  return fallback;
}

/** `stroke-dasharray="..."`-Attribut oder leerer String - für die
 *  String-Templates in imageExport.ts. */
export function dashAttr(shape: ShapeInstance, fallback?: string): string {
  const dash = resolveDashArray(shape, fallback);
  return dash ? ` stroke-dasharray="${dash}"` : "";
}
