import type { ShapeInstance } from "../shapes/types";
import { ShapeRegistry } from "../shapes/ShapeRegistry";

interface ShapePortsProps {
  shape: ShapeInstance;
  visible: boolean;
  onPortMouseDown: (portId: string, e: React.MouseEvent) => void;
}

const PORT_RADIUS = 5;

/**
 * Rendert die Ports einer Shape als kleine Kreise (relativ zur Shape positioniert,
 * da diese Komponente innerhalb der bereits transformierten <g> der Shape sitzt).
 */
export function ShapePorts({ shape, visible, onPortMouseDown }: ShapePortsProps) {
  if (!visible) return null;
  const definition = ShapeRegistry.get(shape.type);
  if (!definition) return null;

  return (
    <g className="shape-ports">
      {definition.ports.map((port) => {
        const cx = port.relativePosition.x * shape.size.width;
        const cy = port.relativePosition.y * shape.size.height;
        return (
          <circle
            key={port.id}
            cx={cx}
            cy={cy}
            r={PORT_RADIUS}
            fill="#ffffff"
            stroke="var(--accent, #3d5a99)"
            strokeWidth={1.5}
            style={{ cursor: "crosshair" }}
            onMouseDown={(e) => {
              e.stopPropagation();
              onPortMouseDown(port.id, e);
            }}
          />
        );
      })}
    </g>
  );
}
