import type { ShapeInstance, ConnectorInstance } from "../shapes/types";
import { useCanvasStore } from "../state/canvasStore";

/**
 * Das gespeicherte Diagramm-Format. Bewusst generisch (Core-Engine-Ebene) -
 * kennt keine BPMN-Spezifika, speichert nur Shapes/Connectors 1:1 aus dem State.
 * BPMN-XML-Export ist eine zusätzliche, separate Serialisierung obendrauf
 * (siehe modules/bpmn/io/bpmnXmlExport.ts), damit die Core-Engine unabhängig bleibt.
 *
 * `favorites` ist optional und rein additiv: ältere Diagramm-Dateien ohne
 * dieses Feld bleiben ladbar. Die Core-Engine kennt hier bewusst nur eine
 * Liste von Strings (Shape-Typen) - welche Typen das sind, ist Sache der
 * Toolbox/UI-Schicht. Serializer/Loader nehmen die Favoriten als Parameter
 * entgegen statt sie selbst aus dem UI-Layer zu importieren, damit die
 * core/io-Schicht unabhängig von src/ui bleibt (Architektur-Trennung).
 */
export interface DiagramFile {
  formatVersion: 1;
  createdAt: string;
  shapes: ShapeInstance[];
  connectors: ConnectorInstance[];
  favorites?: string[];
}

export function serializeDiagram(favoriteTypes?: Set<string>): DiagramFile {
  const state = useCanvasStore.getState();
  return {
    formatVersion: 1,
    createdAt: new Date().toISOString(),
    shapes: Object.values(state.shapes),
    connectors: Object.values(state.connectors),
    ...(favoriteTypes && favoriteTypes.size > 0 ? { favorites: Array.from(favoriteTypes) } : {}),
  };
}

export function diagramToJson(favoriteTypes?: Set<string>): string {
  return JSON.stringify(serializeDiagram(favoriteTypes), null, 2);
}

export interface LoadDiagramResult {
  success: true;
  /** Im Diagramm mitgespeicherte Favoriten, falls vorhanden - der Aufrufer
   *  entscheidet, ob/wie er sie in den Favoriten-Store übernimmt. */
  favorites?: string[];
}

/** Lädt ein zuvor exportiertes Diagramm zurück in den Store (ersetzt den aktuellen Inhalt). */
export function loadDiagramFromJson(json: string): LoadDiagramResult | { success: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { success: false, error: "Die Datei enthält kein gültiges JSON." };
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("shapes" in parsed) ||
    !("connectors" in parsed) ||
    !Array.isArray((parsed as DiagramFile).shapes) ||
    !Array.isArray((parsed as DiagramFile).connectors)
  ) {
    return { success: false, error: "Die Datei hat nicht das erwartete Diagramm-Format." };
  }

  const diagram = parsed as DiagramFile;
  const shapesRecord: Record<string, ShapeInstance> = {};
  diagram.shapes.forEach((s) => (shapesRecord[s.id] = s));
  const connectorsRecord: Record<string, ConnectorInstance> = {};
  diagram.connectors.forEach((c) => (connectorsRecord[c.id] = c));

  useCanvasStore.setState({
    shapes: shapesRecord,
    connectors: connectorsRecord,
    selectedShapeIds: [],
    selectedConnectorId: null,
  });

  const favorites =
    Array.isArray(diagram.favorites) && diagram.favorites.every((f) => typeof f === "string")
      ? diagram.favorites
      : undefined;

  return { success: true, favorites };
}
