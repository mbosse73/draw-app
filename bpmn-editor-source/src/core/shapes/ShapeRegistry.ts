import type { ShapeDefinition } from "./types";

/**
 * Zentrale Registry für Shape-Module (Plugin-Mechanismus).
 * Module rufen registerShape() beim Laden auf, die Core-Engine
 * fragt hier nur ab, was aktuell registriert ist.
 */
class ShapeRegistryImpl {
  private definitions = new Map<string, ShapeDefinition>();

  register(definition: ShapeDefinition): void {
    if (this.definitions.has(definition.type)) {
      console.warn(`Shape-Typ "${definition.type}" wird überschrieben.`);
    }
    this.definitions.set(definition.type, definition);
  }

  get(type: string): ShapeDefinition | undefined {
    return this.definitions.get(type);
  }

  getAll(): ShapeDefinition[] {
    return Array.from(this.definitions.values());
  }

  getByCategory(): Map<string, ShapeDefinition[]> {
    const grouped = new Map<string, ShapeDefinition[]>();
    for (const def of this.definitions.values()) {
      const list = grouped.get(def.category) ?? [];
      list.push(def);
      grouped.set(def.category, list);
    }
    return grouped;
  }
}

// Singleton - eine Registry pro Anwendung
export const ShapeRegistry = new ShapeRegistryImpl();
