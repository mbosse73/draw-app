import type { ArrowHeadStyle, ConnectorInstance, ConnectorLineStyle } from "../shapes/types";
import type { ConnectorTypeDefinition } from "../shapes/ConnectorTypeRegistry";

/**
 * Einzige Quelle für die Auflösung von Verbindungs-Darstellung (Linienstil,
 * Pfeilspitzen) UND für deren Marker-Geometrie. Wird sowohl vom Live-Renderer
 * (ConnectorLayer.tsx, JSX) als auch vom eigenständigen Export-Renderer
 * (core/io/imageExport.ts, SVG-Strings) importiert, damit neue Stil-Optionen
 * nicht wie in Abschnitt 4.5 der Doku beschrieben an einer der beiden Stellen
 * vergessen werden.
 */

export function resolveConnectorLineStyle(
  connector: Pick<ConnectorInstance, "style">,
  typeDef: Pick<ConnectorTypeDefinition, "lineStyle">
): ConnectorLineStyle {
  return connector.style?.lineStyle ?? typeDef.lineStyle;
}

export function resolveConnectorArrowStyle(
  connector: Pick<ConnectorInstance, "style">,
  typeDef: Pick<ConnectorTypeDefinition, "showArrow">
): { start: ArrowHeadStyle; end: ArrowHeadStyle } {
  return {
    start: connector.style?.startArrow ?? "none",
    end: connector.style?.endArrow ?? (typeDef.showArrow ? "arrow" : "none"),
  };
}

export function dashArrayFor(lineStyle: ConnectorLineStyle): string | undefined {
  if (lineStyle === "dashed") return "8 5";
  if (lineStyle === "dotted") return "2 4";
  return undefined;
}

interface ArrowMarkerShape {
  viewBox: string;
  refX: number;
  refY: number;
  element: "path" | "circle";
  d?: string;
  cx?: number;
  cy?: number;
  r?: number;
}

/** Geometrie je Pfeilspitzen-Variante, unabhängig von Farbe/Verwendungsort. */
export const ARROW_MARKER_SHAPES: Record<Exclude<ArrowHeadStyle, "none">, ArrowMarkerShape> = {
  arrow: { viewBox: "0 0 10 10", refX: 9, refY: 5, element: "path", d: "M 0 0 L 10 5 L 0 10 z" },
  diamond: { viewBox: "0 0 10 10", refX: 9, refY: 5, element: "path", d: "M 0 5 L 5 0 L 10 5 L 5 10 Z" },
  circle: { viewBox: "0 0 10 10", refX: 5, refY: 5, element: "circle", cx: 5, cy: 5, r: 4 },
};

export interface ArrowMarkerVariant {
  /** Kurzes Suffix für die Marker-ID, z.B. "normal" | "selected" | "export". */
  id: string;
  color: string;
}

export interface ArrowMarkerDescriptor extends ArrowMarkerShape {
  elementId: string;
  color: string;
}

/** Baut die vollständige Liste zu rendernder <marker>-Elemente (Geometrie x Farbvariante). */
export function arrowMarkerDescriptors(variants: ArrowMarkerVariant[]): ArrowMarkerDescriptor[] {
  const descriptors: ArrowMarkerDescriptor[] = [];
  for (const style of Object.keys(ARROW_MARKER_SHAPES) as Exclude<ArrowHeadStyle, "none">[]) {
    const shape = ARROW_MARKER_SHAPES[style];
    for (const variant of variants) {
      // style ist hier nie "none" (kommt aus ARROW_MARKER_SHAPES), daher
      // liefert arrowMarkerElementId garantiert eine ID statt undefined.
      descriptors.push({ ...shape, elementId: arrowMarkerElementId(style, variant.id)!, color: variant.color });
    }
  }
  return descriptors;
}

/** ID einer bestimmten Marker-Definition, oder undefined für "keine Pfeilspitze". */
export function arrowMarkerElementId(style: ArrowHeadStyle, variantId: string): string | undefined {
  if (style === "none") return undefined;
  return `arrow-marker-${style}-${variantId}`;
}
