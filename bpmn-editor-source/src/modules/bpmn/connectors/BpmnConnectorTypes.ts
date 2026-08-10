import { ConnectorTypeRegistry } from "../../../core/shapes/ConnectorTypeRegistry";

/**
 * Die drei BPMN-2.0-Verbindungstypen. Sequenzfluss ist die normale
 * durchgezogene Linie mit Pfeilspitze zwischen Aktivitäten. Nachrichtenfluss
 * (gestrichelt) verbindet i.d.R. Elemente über Pool-Grenzen hinweg.
 * Assoziation (gepunktet, ohne Pfeilspitze) verknüpft z.B. Datenobjekte
 * lose mit Aktivitäten.
 */
export function registerBpmnConnectorTypes() {
  ConnectorTypeRegistry.register({
    type: "bpmn.sequenceFlow",
    label: "Sequenzfluss",
    lineStyle: "solid",
    showArrow: true,
  });
  ConnectorTypeRegistry.register({
    type: "bpmn.messageFlow",
    label: "Nachrichtenfluss",
    lineStyle: "dashed",
    showArrow: true,
  });
  ConnectorTypeRegistry.register({
    type: "bpmn.association",
    label: "Assoziation",
    lineStyle: "dotted",
    showArrow: false,
  });
}
