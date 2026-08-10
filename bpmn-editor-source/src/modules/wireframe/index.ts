import { registerWindowShapes } from "./shapes/WindowShapes";
import { registerContainerShapes } from "./shapes/ContainerShapes";
import { registerMenuShapes } from "./shapes/MenuShapes";
import { registerInputShapes } from "./shapes/InputShapes";
import { registerButtonShapes } from "./shapes/ButtonShapes";
import { registerDataDisplayShapes } from "./shapes/DataDisplayShapes";
import { registerTextShapes } from "./shapes/TextShapes";
import { registerMarkupShapes } from "./shapes/MarkupShapes";
import { registerWireframeConnectorTypes } from "./connectors/WireframeConnectorTypes";

/**
 * Registriert das komplette Desktop-Wireframe-Modul bei der Core-Engine.
 * Einziger Kontaktpunkt zwischen Modul und Engine (Plugin-Prinzip, analog
 * zu modules/bpmn/index.ts) - die Core-Engine kennt keinen einzigen der
 * hier registrierten Typen namentlich.
 */
export function registerWireframeModule() {
  registerWindowShapes();
  registerContainerShapes();
  registerMenuShapes();
  registerInputShapes();
  registerButtonShapes();
  registerDataDisplayShapes();
  registerTextShapes();
  registerMarkupShapes();
  registerWireframeConnectorTypes();
}
