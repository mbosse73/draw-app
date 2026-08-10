import type { Viewport } from "../state/canvasStore";

interface GridLayerProps {
  viewport: Viewport;
  gridSize: number;
}

/**
 * Rendert ein Punktraster über ein SVG <pattern>.
 * Das ist performant, weil der Browser das Pattern kachelt statt
 * dass wir tausende <circle>-Elemente manuell erzeugen müssen.
 */
export function GridLayer({ viewport, gridSize }: GridLayerProps) {
  const scaledSize = gridSize * viewport.zoom;
  // Grid-Offset muss mit dem Pan mitwandern, aber innerhalb einer Zellgröße bleiben
  const offsetX = viewport.x % scaledSize;
  const offsetY = viewport.y % scaledSize;

  // Punkte bei starkem Rauszoomen ausblenden, um visuelles Rauschen zu vermeiden
  const dotOpacity = scaledSize < 6 ? 0 : Math.min(1, (scaledSize - 6) / 10);

  return (
    <>
      <defs>
        <pattern
          id="grid-pattern"
          width={scaledSize}
          height={scaledSize}
          patternUnits="userSpaceOnUse"
          patternTransform={`translate(${offsetX} ${offsetY})`}
        >
          <circle
            cx={scaledSize / 2}
            cy={scaledSize / 2}
            r={1}
            fill="var(--grid-dot-color, #c0c0c0)"
            opacity={dotOpacity}
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid-pattern)" />
    </>
  );
}
