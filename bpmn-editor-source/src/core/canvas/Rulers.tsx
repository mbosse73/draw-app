import { useRef, type RefObject } from "react";
import { useCanvasStore, type Viewport } from "../state/canvasStore";

interface RulersProps {
  viewport: Viewport;
  containerRef: RefObject<HTMLDivElement | null>;
}

const RULER_THICKNESS = 20;

/** Wählt eine "schöne" Tick-Distanz (1/2/5 * 10^n) nahe dem Zielabstand in
 *  Weltkoordinaten, damit die Beschriftung bei jedem Zoomlevel lesbar bleibt. */
function niceTickStep(targetWorldStep: number): number {
  const exponent = Math.floor(Math.log10(targetWorldStep));
  const base = Math.pow(10, exponent);
  const fraction = targetWorldStep / base;
  const niceFraction = fraction < 1.5 ? 1 : fraction < 3.5 ? 2 : fraction < 7.5 ? 5 : 10;
  return niceFraction * base;
}

/**
 * Lineale am oberen/linken Zeichenflächenrand mit Weltkoordinaten-Ticks
 * (Z-17). Zieht man aus einem Lineal auf die Zeichenfläche, entsteht eine
 * neue, persistente Hilfslinie (`guides` im Store) - bewusst über eigene
 * `window`-Listener gelöst statt über die drei zentralen CanvasEngine-Handler
 * (siehe dortige Ref-Zustandsmaschine): das Erzeugen einer Hilfslinie ist ein
 * klar abgegrenzter, unabhängiger Vorgang und muss diese Maschine nicht um
 * einen weiteren exklusiven Ref erweitern.
 */
export function Rulers({ viewport, containerRef }: RulersProps) {
  const addGuide = useCanvasStore((s) => s.addGuide);
  const moveGuide = useCanvasStore((s) => s.moveGuide);
  const draggingGuideId = useRef<string | null>(null);
  const draggingAxis = useRef<"horizontal" | "vertical" | null>(null);

  const targetPixelStep = 70;
  const targetWorldStep = targetPixelStep / viewport.zoom;
  const step = niceTickStep(targetWorldStep);

  const worldPositionFor = (axis: "horizontal" | "vertical", clientX: number, clientY: number, rect: DOMRect): number =>
    axis === "horizontal" ? (clientY - rect.top - viewport.y) / viewport.zoom : (clientX - rect.left - viewport.x) / viewport.zoom;

  const startGuideDrag = (axis: "horizontal" | "vertical", e: React.MouseEvent) => {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const id = addGuide(axis, worldPositionFor(axis, e.clientX, e.clientY, rect));
    draggingGuideId.current = id;
    draggingAxis.current = axis;

    const handleMove = (moveEvent: MouseEvent) => {
      const r = containerRef.current?.getBoundingClientRect();
      if (!r || !draggingGuideId.current || !draggingAxis.current) return;
      moveGuide(draggingGuideId.current, worldPositionFor(draggingAxis.current, moveEvent.clientX, moveEvent.clientY, r));
    };
    const handleUp = () => {
      draggingGuideId.current = null;
      draggingAxis.current = null;
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  };

  const horizontalTicks: Array<{ screenX: number; label: number }> = [];
  const containerWidth = containerRef.current?.clientWidth ?? 2000;
  const containerHeight = containerRef.current?.clientHeight ?? 2000;
  const firstWorldX = Math.floor((-viewport.x / viewport.zoom) / step) * step;
  for (let worldX = firstWorldX; worldX * viewport.zoom + viewport.x < containerWidth + step * viewport.zoom; worldX += step) {
    horizontalTicks.push({ screenX: worldX * viewport.zoom + viewport.x, label: Math.round(worldX) });
  }
  const verticalTicks: Array<{ screenY: number; label: number }> = [];
  const firstWorldY = Math.floor((-viewport.y / viewport.zoom) / step) * step;
  for (let worldY = firstWorldY; worldY * viewport.zoom + viewport.y < containerHeight + step * viewport.zoom; worldY += step) {
    verticalTicks.push({ screenY: worldY * viewport.zoom + viewport.y, label: Math.round(worldY) });
  }

  return (
    <>
      <div
        className="ruler ruler-horizontal"
        style={{ left: RULER_THICKNESS, height: RULER_THICKNESS }}
        onMouseDown={(e) => startGuideDrag("horizontal", e)}
        title="Ziehen für eine horizontale Hilfslinie"
      >
        <svg width="100%" height={RULER_THICKNESS} style={{ display: "block", overflow: "visible" }}>
          {horizontalTicks.map(({ screenX, label }) => (
            <g key={label}>
              <line x1={screenX} y1={RULER_THICKNESS} x2={screenX} y2={RULER_THICKNESS - 8} stroke="var(--text, #888)" strokeWidth={1} />
              <text x={screenX + 3} y={10} fontSize={9} fill="var(--text, #888)">{label}</text>
            </g>
          ))}
        </svg>
      </div>
      <div
        className="ruler ruler-vertical"
        style={{ top: RULER_THICKNESS, width: RULER_THICKNESS }}
        onMouseDown={(e) => startGuideDrag("vertical", e)}
        title="Ziehen für eine vertikale Hilfslinie"
      >
        <svg width={RULER_THICKNESS} height="100%" style={{ display: "block", overflow: "visible" }}>
          {verticalTicks.map(({ screenY, label }) => (
            <g key={label}>
              <line x1={RULER_THICKNESS} y1={screenY} x2={RULER_THICKNESS - 8} y2={screenY} stroke="var(--text, #888)" strokeWidth={1} />
              <text x={2} y={screenY - 3} fontSize={9} fill="var(--text, #888)" transform={`rotate(-90 2 ${screenY - 3})`}>
                {label}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <div className="ruler ruler-corner" style={{ width: RULER_THICKNESS, height: RULER_THICKNESS }} />
    </>
  );
}
