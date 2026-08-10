import type { ConnectorLineStyle } from "./types";

export interface ConnectorTypeDefinition {
  type: string;
  label: string;
  lineStyle: ConnectorLineStyle;
  /** Pfeilspitze am Ziel-Ende zeichnen (Sequenzfluss: ja, Assoziation: meist nein) */
  showArrow: boolean;
}

/**
 * Registry für Verbindungstypen, analog zur ShapeRegistry für Shapes.
 * Module (z.B. BPMN) registrieren hier ihre Linientypen mit Darstellung;
 * die Core-Engine (ConnectorLayer) kennt nur generische Linienstile.
 */
class ConnectorTypeRegistryImpl {
  private definitions = new Map<string, ConnectorTypeDefinition>();

  register(definition: ConnectorTypeDefinition): void {
    this.definitions.set(definition.type, definition);
  }

  get(type: string | undefined): ConnectorTypeDefinition | undefined {
    if (!type) return undefined;
    return this.definitions.get(type);
  }

  getAll(): ConnectorTypeDefinition[] {
    return Array.from(this.definitions.values());
  }
}

export const ConnectorTypeRegistry = new ConnectorTypeRegistryImpl();

/** Default-Darstellung für Verbindungen ohne (oder mit unbekanntem) connectorType. */
export const DEFAULT_CONNECTOR_STYLE: ConnectorTypeDefinition = {
  type: "default",
  label: "Standard",
  lineStyle: "solid",
  showArrow: true,
};
