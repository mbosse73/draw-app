interface RotateHandleProps {
  /** X-Koordinate des Griffs (Shape-Mittelpunkt X, unrotiert). */
  x: number;
  /** Y-Koordinate des Griffs, oberhalb der Shape. */
  y: number;
  /** Obere Kante der Shape (unrotiert) - Ansatzpunkt der Verbindungslinie zum Griff. */
  anchorY: number;
  onRotateStart: (e: React.MouseEvent) => void;
  onResetRotation: () => void;
}

const HANDLE_RADIUS = 6;

/** Kleiner Dreh-Griff oberhalb einer selektierten, rotierbaren Shape. Liegt
 *  innerhalb derselben rotate()-Transform-Gruppe wie die Shape selbst
 *  (siehe CanvasEngine.tsx) und dreht sich deshalb optisch mit ihr mit. */
export function RotateHandle({ x, y, anchorY, onRotateStart, onResetRotation }: RotateHandleProps) {
  return (
    <g>
      <line x1={x} y1={anchorY} x2={x} y2={y} stroke="var(--accent, #3d5a99)" strokeWidth={1} strokeDasharray="2 2" />
      <circle
        cx={x}
        cy={y}
        r={HANDLE_RADIUS}
        fill="#ffffff"
        stroke="var(--accent, #3d5a99)"
        strokeWidth={2}
        style={{ cursor: "grab" }}
        onMouseDown={(e) => {
          e.stopPropagation();
          onRotateStart(e);
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          onResetRotation();
        }}
      />
    </g>
  );
}
