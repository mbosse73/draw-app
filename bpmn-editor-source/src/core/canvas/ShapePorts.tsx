import type { ShapeInstance } from "../shapes/types";
import { ShapeRegistry } from "../shapes/ShapeRegistry";

interface ShapePortsProps {
  shape: ShapeInstance;
  visible: boolean;
  onPortMouseDown: (portId: string, e: React.MouseEvent) => void;
}

const PORT_RADIUS = 5;
/**
 * Trefferradius über dem sichtbaren Radius (F-11). Ein 5-px-Kreis ist als
 * Klickziel zu klein - dieselbe Überlegung wie beim breiten, unsichtbaren
 * Hit-Pfad der Verbindungen (ConnectorLayer.tsx). 8 px gewählt, weil dort der
 * Ring des Hover-Pfeils beginnt (Abstand 18 px, Radius 10): So stoßen beide
 * Trefferflächen exakt aneinander, ohne sich zu überlappen.
 */
const PORT_HIT_RADIUS = 8;

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
        const beginneVerbindung = (e: React.MouseEvent) => {
          e.stopPropagation();
          onPortMouseDown(port.id, e);
        };
        return (
          <g key={port.id} style={{ cursor: "crosshair" }} onMouseDown={beginneVerbindung}>
            {/* Unsichtbare, aber "gemalte" (fill="transparent" statt "none")
                Trefferfläche - siehe PORT_HIT_RADIUS. */}
            <circle cx={cx} cy={cy} r={PORT_HIT_RADIUS} fill="transparent" />
            <circle
              cx={cx}
              cy={cy}
              r={PORT_RADIUS}
              fill="#ffffff"
              stroke="var(--accent, #3d5a99)"
              strokeWidth={1.5}
            />
          </g>
        );
      })}
    </g>
  );
}
