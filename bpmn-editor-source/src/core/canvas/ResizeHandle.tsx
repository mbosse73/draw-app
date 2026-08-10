/** Die 8 Griffpositionen: 4 Ecken + 4 Kantenmitten (Z-01). */
export type ResizeDirection = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw";

interface ResizeHandleProps {
  width: number;
  height: number;
  onResizeStart: (direction: ResizeDirection, e: React.MouseEvent) => void;
}

const HANDLE_SIZE = 10;

const CURSOR_FOR_DIRECTION: Record<ResizeDirection, string> = {
  n: "ns-resize",
  s: "ns-resize",
  e: "ew-resize",
  w: "ew-resize",
  ne: "nesw-resize",
  sw: "nesw-resize",
  nw: "nwse-resize",
  se: "nwse-resize",
};

/** Rendert Ziehgriffe an allen 8 Punkten (4 Ecken + 4 Kantenmitten) einer
 *  selektierten Shape, zum Ändern der Größe (Z-01) - vorher gab es nur einen
 *  einzelnen Griff unten rechts. */
export function ResizeHandle({ width, height, onResizeStart }: ResizeHandleProps) {
  const positions: Record<ResizeDirection, { x: number; y: number }> = {
    nw: { x: 0, y: 0 },
    n: { x: width / 2, y: 0 },
    ne: { x: width, y: 0 },
    e: { x: width, y: height / 2 },
    se: { x: width, y: height },
    s: { x: width / 2, y: height },
    sw: { x: 0, y: height },
    w: { x: 0, y: height / 2 },
  };

  return (
    <g className="resize-handles">
      {(Object.keys(positions) as ResizeDirection[]).map((direction) => {
        const { x, y } = positions[direction];
        return (
          <rect
            key={direction}
            x={x - HANDLE_SIZE / 2}
            y={y - HANDLE_SIZE / 2}
            width={HANDLE_SIZE}
            height={HANDLE_SIZE}
            fill="var(--accent, #3d5a99)"
            stroke="#ffffff"
            strokeWidth={1}
            style={{ cursor: CURSOR_FOR_DIRECTION[direction] }}
            onMouseDown={(e) => {
              e.stopPropagation();
              onResizeStart(direction, e);
            }}
          />
        );
      })}
    </g>
  );
}
