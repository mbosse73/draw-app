import type { ShapeInstance } from "../../../core/shapes/types";

// Standard-Größen für BPMN 2.0 Elemente, angelehnt an die üblichen
// Proportionen aus draw.io/Camunda Modeler für Wiedererkennbarkeit.

export const EVENT_SIZE = { width: 36, height: 36 };
export const TASK_SIZE = { width: 120, height: 80 };
export const GATEWAY_SIZE = { width: 50, height: 50 };
export const DATA_OBJECT_SIZE = { width: 40, height: 54 };

export const BPMN_COLORS = {
  stroke: "#454d5a",
  // An --accent gekoppelt (statt hartkodiertem Hex), damit die
  // Selektionsfarbe automatisch zum aktuellen UI-Theme passt (siehe
  // UI-DESIGNGUIDE.md-Umstellung) - die Zeichenfläche selbst bleibt
  // themeunabhängig hell ("Papier"), nur die Auswahl-Hervorhebung soll
  // den Akzent des jeweils aktiven Themes spiegeln. Fällt außerhalb eines
  // Theme-Kontexts (z.B. Storybook) auf den ursprünglichen Wert zurück.
  strokeSelected: "var(--accent, #3d5a99)",
  fill: "#ffffff",
  taskFill: "#f8fafc",
  text: "#2f3540",
  icon: "#626b7a",
};

/**
 * Löst den generischen Stil-Panel-Override (Z-15, `shape.style.*`) gegen den
 * BPMN-typischen Default auf. Zentrale Stelle, damit jeder BPMN-Shape-Render
 * dieselbe Logik nutzt statt sie pro Datei zu wiederholen - siehe Anwendung
 * in TaskShapes.tsx/EventShapes.tsx/etc. Bewusst hier (BPMN-Modul), nicht in
 * core/, weil nur BPMN-Shapes aktuell so auf shape.style reagieren (siehe
 * Abschnitt 4.5-artige Einschränkung, im Technik-Dokument vermerkt).
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

/** Ports für rechteckige Elemente (Tasks): 4 Seiten mittig. */
export const RECTANGLE_PORTS = [
  { id: "top", relativePosition: { x: 0.5, y: 0 } },
  { id: "right", relativePosition: { x: 1, y: 0.5 } },
  { id: "bottom", relativePosition: { x: 0.5, y: 1 } },
  { id: "left", relativePosition: { x: 0, y: 0.5 } },
];
