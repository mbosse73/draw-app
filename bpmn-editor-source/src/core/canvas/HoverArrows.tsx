import type { ShapeInstance } from "../shapes/types";

export type HoverDirection = "top" | "right" | "bottom" | "left";

interface HoverArrowsProps {
  shape: ShapeInstance;
  visible: boolean;
  onArrowMouseDown: (direction: HoverDirection, e: React.MouseEvent) => void;
}

const GAP = 18;
const SIZE = 20;

const ARROW_GLYPH: Record<HoverDirection, string> = {
  top: "M 0 -6 L 6 4 L -6 4 Z",
  bottom: "M 0 6 L 6 -4 L -6 -4 Z",
  left: "M -6 0 L 4 6 L 4 -6 Z",
  right: "M 6 0 L -4 6 L -4 -6 Z",
};

/**
 * Gerichtete Hover-Pfeile an allen 4 Seiten einer Shape (Z-06): Klick oder
 * Klick+Ziehen erzeugt automatisch ein neues, bereits verbundenes Shape in
 * der jeweiligen Richtung - der schnellste Weg, ein Diagramm "wachsen zu
 * lassen", ohne manuell aus der Toolbox zu ziehen und dann zu verbinden
 * (das in draw.io meistgenutzte Werkzeug für genau diesen Anwendungsfall).
 * Rein generisch (kein BPMN-Wissen): erzeugt beim Loslassen ein neues Shape
 * vom selben `type` wie die Ausgangs-Shape, siehe CanvasEngine.tsx.
 */
/** Unsichtbare Brücken-Rechtecke vom Shape-Rand bis zum jeweiligen Pfeil-
 *  Mittelpunkt (siehe Kommentar unten zu "Dead Zone"). */
function bridgeRectFor(direction: HoverDirection, width: number, height: number): { x: number; y: number; width: number; height: number } {
  if (direction === "top") return { x: width / 2 - SIZE / 2, y: -GAP, width: SIZE, height: GAP };
  if (direction === "bottom") return { x: width / 2 - SIZE / 2, y: height, width: SIZE, height: GAP };
  if (direction === "left") return { x: -GAP, y: height / 2 - SIZE / 2, width: GAP, height: SIZE };
  return { x: width, y: height / 2 - SIZE / 2, width: GAP, height: SIZE };
}

export function HoverArrows({ shape, visible, onArrowMouseDown }: HoverArrowsProps) {
  if (!visible) return null;
  const { width, height } = shape.size;

  const positions: Record<HoverDirection, { x: number; y: number }> = {
    top: { x: width / 2, y: -GAP },
    bottom: { x: width / 2, y: height + GAP },
    left: { x: -GAP, y: height / 2 },
    right: { x: width + GAP, y: height / 2 },
  };

  return (
    <g className="hover-arrows">
      {(Object.keys(positions) as HoverDirection[]).map((direction) => {
        const { x, y } = positions[direction];
        const bridge = bridgeRectFor(direction, width, height);
        return (
          <g key={direction}>
            {/* Der Pfeil sitzt bewusst außerhalb der Shape (GAP-Abstand), damit
                er nicht mit dem Inhalt überlappt. Ohne diese Brücke entsteht
                dazwischen eine "tote Zone" ohne jedes gemalte Element - die
                Maus verlässt beim Hinbewegen zum Pfeil kurzzeitig JEDE
                Trefferfläche der Shape-Gruppe, wodurch deren onMouseLeave
                feuert, hoveredShapeId zurückgesetzt wird und die Pfeile
                verschwinden, bevor der Klick sie je erreicht (per Playwright
                nachgestellt: die Pfeile verschwanden exakt beim Übertreten des
                Shape-Rands, noch bevor die Maus beim Pfeil ankam). Diese
                transparente, aber "gemalte" (fill="transparent" statt "none")
                Brücke schließt die Lücke, ohne selbst einen eigenen Klick-
                Handler zu brauchen - ein Klick darauf blubbert einfach zum
                normalen Shape-Mousedown durch. */}
            <rect
              x={bridge.x}
              y={bridge.y}
              width={bridge.width}
              height={bridge.height}
              fill="transparent"
            />
            <g
              transform={`translate(${x} ${y})`}
              style={{ cursor: "copy" }}
              onMouseDown={(e) => {
                e.stopPropagation();
                onArrowMouseDown(direction, e);
              }}
            >
              <circle r={SIZE / 2} fill="var(--accent, #3d5a99)" opacity={0.85} />
              <path d={ARROW_GLYPH[direction]} fill="#ffffff" />
            </g>
          </g>
        );
      })}
    </g>
  );
}
