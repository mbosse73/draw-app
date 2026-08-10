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
/** Titel/Stichwörter der Zeichnung selbst (nicht der Shapes) - für die
 *  Bibliotheks-Suche (siehe ui/Library/LibraryPanel.tsx). Bewusst IN der
 *  Diagrammdatei gespeichert statt in einer separaten Browser-Datenbank:
 *  das macht die Bibliothek robust gegen gelöschten Browser-Speicher (siehe
 *  BPMN-Editor-Technische-Dokumentation.md Abschnitt 4.9) - die Datei auf
 *  der Festplatte bleibt immer die Quelle der Wahrheit. */
export interface DiagramMeta {
  title: string;
  keywords: string[];
}

export interface DiagramFile {
  formatVersion: 1;
  createdAt: string;
  shapes: ShapeInstance[];
  connectors: ConnectorInstance[];
  favorites?: string[];
  meta?: DiagramMeta;
}

export function serializeDiagram(favoriteTypes?: Set<string>): DiagramFile {
  const state = useCanvasStore.getState();
  const meta = state.diagramMeta;
  const hasMeta = Boolean(meta.title.trim()) || meta.keywords.length > 0;
  return {
    formatVersion: 1,
    createdAt: new Date().toISOString(),
    shapes: Object.values(state.shapes),
    connectors: Object.values(state.connectors),
    ...(favoriteTypes && favoriteTypes.size > 0 ? { favorites: Array.from(favoriteTypes) } : {}),
    ...(hasMeta ? { meta } : {}),
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
  /** Titel/Stichwörter der geladenen Zeichnung, bereits in den Store
   *  übernommen (siehe unten) - hier zusätzlich zurückgegeben, falls ein
   *  Aufrufer (z.B. die Bibliothek) direkt darauf reagieren möchte. */
  meta: DiagramMeta;
}

/**
 * Strukturelle Validierung VOR jedem Import (siehe BACKUP-SYSTEM-ANWEISUNG.md
 * Abschnitt 6) - verhindert, dass eine kaputte oder fremde JSON-Datei die
 * Live-Daten mit Datenmüll überschreibt und z.B. beim Rendern crasht, weil
 * ein Shape kein `position`/`size` hat. Prüft nur die generischen
 * Core-Pflichtfelder aus ShapeInstance/ConnectorInstance, keine
 * modul-/BPMN-spezifischen (die Core-Ebene kennt die nicht).
 */
function validateDiagram(obj: DiagramFile): string | null {
  for (const s of obj.shapes) {
    if (typeof s !== "object" || s === null) return "Ungültiges Element in \"shapes\" gefunden.";
    if (typeof s.id !== "string" || typeof s.type !== "string") return "Element in \"shapes\" ohne gültige id/type.";
    if (typeof s.position?.x !== "number" || typeof s.position?.y !== "number")
      return `Element "${s.id}" hat keine gültige Position.`;
    if (typeof s.size?.width !== "number" || typeof s.size?.height !== "number")
      return `Element "${s.id}" hat keine gültige Größe.`;
  }
  for (const c of obj.connectors) {
    if (typeof c !== "object" || c === null) return "Ungültiges Element in \"connectors\" gefunden.";
    if (typeof c.id !== "string" || typeof c.sourceShapeId !== "string" || typeof c.targetShapeId !== "string")
      return "Verbindung ohne gültige id/sourceShapeId/targetShapeId gefunden.";
  }
  return null;
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
  const validationError = validateDiagram(diagram);
  if (validationError) {
    return { success: false, error: validationError };
  }
  const shapesRecord: Record<string, ShapeInstance> = {};
  diagram.shapes.forEach((s) => (shapesRecord[s.id] = s));
  const connectorsRecord: Record<string, ConnectorInstance> = {};
  diagram.connectors.forEach((c) => (connectorsRecord[c.id] = c));

  // Titel/Stichwörter der geladenen Datei übernehmen (ersetzt die des
  // vorherigen Diagramms komplett, kein additives Mergen wie bei Favoriten -
  // Meta gehört zu genau EINER Zeichnung, nicht zu einer geräteweiten Liste).
  // Fehlt `meta` (ältere Dateien vor diesem Feature), wird auf leer zurückgesetzt.
  const meta: DiagramMeta = {
    title: typeof diagram.meta?.title === "string" ? diagram.meta.title : "",
    keywords: Array.isArray(diagram.meta?.keywords) ? diagram.meta.keywords.filter((k) => typeof k === "string") : [],
  };

  useCanvasStore.setState({
    shapes: shapesRecord,
    connectors: connectorsRecord,
    selectedShapeIds: [],
    selectedConnectorId: null,
    diagramMeta: meta,
  });

  const favorites =
    Array.isArray(diagram.favorites) && diagram.favorites.every((f) => typeof f === "string")
      ? diagram.favorites
      : undefined;

  return { success: true, favorites, meta };
}
