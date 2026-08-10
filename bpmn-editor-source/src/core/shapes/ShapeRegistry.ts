import type { ShapeDefinition, ShapeInstance } from "./types";

/**
 * Zweitdarstellung einer Shape als reiner SVG-String (Bild-Export).
 * Bewusst DOM-frei und ohne React, weil der Export auch außerhalb eines
 * Browser-Renderings laufen können muss (siehe scripts/check-export.mjs).
 */
export type StaticSvgRenderer = (shape: ShapeInstance) => string;

/**
 * Zentrale Registry für Shape-Module (Plugin-Mechanismus).
 * Module rufen registerShape() beim Laden auf, die Core-Engine
 * fragt hier nur ab, was aktuell registriert ist.
 */
class ShapeRegistryImpl {
  private definitions = new Map<string, ShapeDefinition>();
  private staticSvgRenderers = new Map<string, StaticSvgRenderer>();

  /**
   * Hinterlegt, wie die Shapes eines Moduls für den Bild-Export gezeichnet
   * werden. Schlüssel ist der `drawingType` des Moduls - derselbe undurchsichtige
   * String, den die Toolbox zur Gruppierung nutzt und den die Core-Engine nie
   * interpretiert.
   *
   * Existiert, damit `core/io/imageExport.ts` nicht länger selbst wissen muss,
   * wie ein BPMN-Task oder ein Wireframe-Button aussieht. Vorher stand beides
   * dort fest verdrahtet, inklusive eines Imports aus `modules/wireframe/` -
   * ein Verstoß gegen die Kernregel, dass `core/` nichts aus einem Modul
   * kennen darf. Jetzt liefert jedes Modul seine Export-Darstellung selbst,
   * genau wie es seine React-Komponenten selbst liefert.
   */
  setStaticSvgRenderer(drawingType: string, render: StaticSvgRenderer): void {
    this.staticSvgRenderers.set(drawingType, render);
  }

  /** Export-Renderer für den Typ einer konkreten Shape, falls das zuständige
   *  Modul einen registriert hat. */
  getStaticSvgRenderer(shapeType: string): StaticSvgRenderer | undefined {
    const drawingType = this.definitions.get(shapeType)?.drawingType;
    return drawingType ? this.staticSvgRenderers.get(drawingType) : undefined;
  }

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
