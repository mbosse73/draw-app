import { registerEventShapes } from "./shapes/EventShapes";
import { registerTaskShapes } from "./shapes/TaskShapes";
import { registerGatewayShapes } from "./shapes/GatewayShapes";
import { registerDataObjectShape } from "./shapes/DataObjectShape";
import { registerPoolAndLaneShapes } from "./shapes/PoolLaneShapes";
import { registerBpmnConnectorTypes } from "./connectors/BpmnConnectorTypes";
import { registerSubProcessShape } from "./shapes/SubProcessShape";
import { registerBoundaryEventShape } from "./shapes/BoundaryEventShape";
import { registerTextShape } from "./shapes/TextShape";
import { ShapeRegistry } from "../../core/shapes/ShapeRegistry";
import { renderBpmnShapeToStaticSvg } from "./io/staticSvg";

/**
 * Registriert das komplette BPMN-2.0-Modul bei der Core-Engine.
 * Dies ist der einzige Kontaktpunkt zwischen Modul und Engine (Plugin-Prinzip, Kap. 4).
 */
export function registerBpmnModule() {
  registerEventShapes();
  registerTaskShapes();
  registerGatewayShapes();
  registerDataObjectShape();
  registerPoolAndLaneShapes();
  registerBpmnConnectorTypes();
  registerSubProcessShape();
  registerBoundaryEventShape();
  registerTextShape();
  // Wie diese Shapes im Bild-Export aussehen, weiß nur das Modul selbst -
  // der Core fragt hier nach, statt es fest verdrahtet zu kennen.
  ShapeRegistry.setStaticSvgRenderer("BPMN 2.0", renderBpmnShapeToStaticSvg);
}
