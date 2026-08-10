import { ConnectorTypeRegistry } from "../../../core/shapes/ConnectorTypeRegistry";

/**
 * Generische Verbindungstypen fürs Wireframe-Modul - kein Sequenzfluss-artiges
 * Prozessmodell wie bei BPMN, sondern einfache Klick-/Verweis-Pfeile für
 * Screenflow-/Klickpfad-Diagramme ("von diesem Button aus gelangt man zu
 * diesem Fenster") und Referenzlinien für Notizen/Markup.
 */
export function registerWireframeConnectorTypes() {
  ConnectorTypeRegistry.register({
    type: "wireframe.clickArrow",
    label: "Klickpfeil",
    lineStyle: "solid",
    showArrow: true,
  });
  ConnectorTypeRegistry.register({
    type: "wireframe.reference",
    label: "Verweislinie",
    lineStyle: "dashed",
    showArrow: false,
  });
}
