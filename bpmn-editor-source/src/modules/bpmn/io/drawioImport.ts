import { useCanvasStore } from "../../../core/state/canvasStore";
import { findContainerAt } from "../../../core/canvas/containment";
import { getAllPortPositions } from "../../../core/canvas/connectorGeometry";
import type { ShapeInstance, ConnectorInstance, Point } from "../../../core/shapes/types";

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Cell-Werte mit html=1 können echtes HTML enthalten (<br>, <div>...</div>) - hier auf reinen, mehrzeiligen Text reduziert. */
function labelFromValue(raw: string | null): string {
  if (!raw) return "";
  return raw
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(div|p)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .trim();
}

function parseStyle(style: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const part of style.split(";")) {
    const token = part.trim();
    if (!token) continue;
    const eq = token.indexOf("=");
    if (eq === -1) map.set(token, "1"); // z.B. "ellipse", "rounded" als bloßes Schlüsselwort
    else map.set(token.slice(0, eq).trim(), token.slice(eq + 1).trim());
  }
  return map;
}

interface RawCell {
  id: string;
  isVertex: boolean;
  isEdge: boolean;
  style: string;
  value: string;
  parent?: string;
  source?: string;
  target?: string;
  geometry?: { x: number; y: number; width: number; height: number };
  points: Point[];
}

const CONTAINER_TYPES = new Set(["bpmn.pool", "bpmn.lane", "bpmn.subProcess"]);

interface TypeGuess {
  type: string;
  data: Record<string, unknown>;
}

/**
 * Erkennt den BPMN-Shape-Typ anhand des draw.io-Stils. Deckt sowohl von
 * dieser App selbst exportierte Dateien ab (siehe drawioExport.ts) als auch
 * typische generische draw.io-Grundformen aus fremden Dateien. Alles nicht
 * erkennbare fällt bewusst auf einen generischen Task zurück (siehe
 * Entscheidung "Best-effort mit Fallback") statt beim Import verworfen zu
 * werden - so geht nie ein Element einer fremden Datei spurlos verloren.
 */
function classifyVertex(cell: RawCell, incoming: number, outgoing: number, hasChildren: boolean): TypeGuess {
  const s = parseStyle(cell.style);
  const label = cell.value || undefined;

  if (s.get("shape") === "pool") {
    return { type: "bpmn.pool", data: { label: label ?? "Pool" } };
  }
  if (s.has("swimlane") && s.get("shape") !== "pool") {
    return { type: "bpmn.lane", data: { label: label ?? "Lane" } };
  }
  if (s.get("shape") === "note") {
    return { type: "bpmn.dataObject", data: { label: label ?? "Data" } };
  }
  if (s.has("rhombus") || s.get("perimeter") === "rhombusPerimeter") {
    const symbol = s.get("symbol");
    const gatewayType = symbol === "parallelGw" ? "parallel" : symbol === "inclusiveGw" ? "inclusive" : "exclusive";
    return { type: `bpmn.gateway.${gatewayType}`, data: { gatewayType, label } };
  }
  if (s.has("ellipse") || s.get("perimeter") === "ellipsePerimeter") {
    const symbol = s.get("symbol");
    const trigger = symbol === "timer" || symbol === "message" || symbol === "error" ? symbol : "none";
    const kind: "start" | "intermediate" | "end" =
      incoming === 0 && outgoing > 0 ? "start" : outgoing === 0 && incoming > 0 ? "end" : "intermediate";
    if (kind === "start" && (trigger === "timer" || trigger === "message")) {
      return { type: `bpmn.event.start.${trigger}`, data: { eventType: kind, trigger, label } };
    }
    if (kind === "end" && (trigger === "error" || trigger === "message")) {
      return { type: `bpmn.event.end.${trigger}`, data: { eventType: kind, trigger, label } };
    }
    if (kind === "intermediate" && (trigger === "timer" || trigger === "message")) {
      return { type: `bpmn.event.intermediate.${trigger}`, data: { eventType: kind, trigger, label } };
    }
    return { type: `bpmn.event.${kind}`, data: { eventType: kind, trigger: "none", label } };
  }
  if (hasChildren) {
    return { type: "bpmn.subProcess", data: { label: label ?? "Sub-Prozess", expanded: true } };
  }
  if (s.has("text") && !s.has("rounded")) {
    return { type: "text.label", data: { label: label ?? "Text", showBorder: false } };
  }
  return { type: "bpmn.task.none", data: { taskType: "none", label: label ?? "" } };
}

function connectorTypeFor(style: string): string {
  const s = parseStyle(style);
  const dashed = s.has("dashed");
  const endFillZero = s.get("endFill") === "0";
  const noEndArrow = s.get("endArrow") === "none";
  if (dashed && noEndArrow) return "bpmn.association";
  if (dashed && endFillZero) return "bpmn.messageFlow";
  if (dashed) return "bpmn.messageFlow";
  return "bpmn.sequenceFlow";
}

function nearestPortId(shape: ShapeInstance, towards: Point): string | null {
  const ports = getAllPortPositions(shape);
  if (ports.length === 0) return null;
  let best = ports[0];
  let bestDist = Infinity;
  for (const p of ports) {
    const d = Math.hypot(p.position.x - towards.x, p.position.y - towards.y);
    if (d < bestDist) {
      bestDist = d;
      best = p;
    }
  }
  return best.portId;
}

export function importDrawioXml(xml: string): { success: true } | { success: false; error: string } {
  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(xml, "application/xml");
  } catch {
    return { success: false, error: "Die Datei enthält kein gültiges XML." };
  }
  if (doc.getElementsByTagName("parsererror").length > 0) {
    return { success: false, error: "Die Datei enthält kein gültiges XML." };
  }

  const cellNodes = Array.from(doc.getElementsByTagName("mxCell"));
  if (cellNodes.length === 0) {
    return { success: false, error: "Keine draw.io-Zellen (mxCell) in der Datei gefunden." };
  }

  const cells = new Map<string, RawCell>();
  for (const node of cellNodes) {
    const id = node.getAttribute("id");
    if (!id) continue;
    const geometryNode = Array.from(node.children).find((c) => c.tagName === "mxGeometry");
    const points: Point[] = [];
    if (geometryNode) {
      const arrayNode = Array.from(geometryNode.children).find(
        (c) => c.tagName === "Array" && c.getAttribute("as") === "points"
      );
      if (arrayNode) {
        Array.from(arrayNode.children).forEach((p) => {
          if (p.tagName !== "mxPoint") return;
          points.push({ x: parseFloat(p.getAttribute("x") ?? "0"), y: parseFloat(p.getAttribute("y") ?? "0") });
        });
      }
    }
    cells.set(id, {
      id,
      isVertex: node.getAttribute("vertex") === "1",
      isEdge: node.getAttribute("edge") === "1",
      style: node.getAttribute("style") ?? "",
      value: labelFromValue(node.getAttribute("value")),
      parent: node.getAttribute("parent") ?? undefined,
      source: node.getAttribute("source") ?? undefined,
      target: node.getAttribute("target") ?? undefined,
      geometry: geometryNode
        ? {
            x: parseFloat(geometryNode.getAttribute("x") ?? "0"),
            y: parseFloat(geometryNode.getAttribute("y") ?? "0"),
            width: parseFloat(geometryNode.getAttribute("width") ?? "0"),
            height: parseFloat(geometryNode.getAttribute("height") ?? "0"),
          }
        : undefined,
      points,
    });
  }

  // Absolute Weltposition je Zelle: rekursiv über die parent-Kette aufsummiert
  // (draw.io speichert die Geometrie von Kindern eines Containers relativ zu
  // dessen eigener Position - unser Modell will dagegen immer absolute
  // Koordinaten je Shape, siehe containment.ts).
  const absoluteCache = new Map<string, Point>();
  function absolutePositionOf(id: string, visited: Set<string> = new Set()): Point {
    const cached = absoluteCache.get(id);
    if (cached) return cached;
    if (visited.has(id)) return { x: 0, y: 0 };
    visited.add(id);
    const cell = cells.get(id);
    if (!cell || !cell.geometry) return { x: 0, y: 0 };
    const parentOrigin =
      !cell.parent || cell.parent === "0" || cell.parent === "1" ? { x: 0, y: 0 } : absolutePositionOf(cell.parent, visited);
    const abs = { x: parentOrigin.x + cell.geometry.x, y: parentOrigin.y + cell.geometry.y };
    absoluteCache.set(id, abs);
    return abs;
  }

  const parentRefs = new Set<string>();
  for (const cell of cells.values()) {
    if (cell.parent) parentRefs.add(cell.parent);
  }

  const incomingCount = new Map<string, number>();
  const outgoingCount = new Map<string, number>();
  for (const cell of cells.values()) {
    if (!cell.isEdge || !cell.source || !cell.target) continue;
    outgoingCount.set(cell.source, (outgoingCount.get(cell.source) ?? 0) + 1);
    incomingCount.set(cell.target, (incomingCount.get(cell.target) ?? 0) + 1);
  }

  const newShapes: ShapeInstance[] = [];
  const idMap = new Map<string, string>();

  for (const cell of cells.values()) {
    if (!cell.isVertex || !cell.geometry) continue;
    if (cell.style.trim() === "group") continue; // reine Auswahl-Gruppierung ohne fachliche Bedeutung

    const guess = classifyVertex(cell, incomingCount.get(cell.id) ?? 0, outgoingCount.get(cell.id) ?? 0, parentRefs.has(cell.id));
    const position = absolutePositionOf(cell.id);
    const newId = generateId("shape");
    idMap.set(cell.id, newId);
    newShapes.push({
      id: newId,
      type: guess.type,
      position,
      size: { width: cell.geometry.width || 40, height: cell.geometry.height || 40 },
      data: guess.data,
      zIndex: 0,
    });
  }

  if (newShapes.length === 0) {
    return { success: false, error: "Keine importierbaren Elemente in der Datei gefunden." };
  }

  // Container zuerst zeichnen (zIndex), damit ihre Kinder optisch darüber liegen.
  const ordered = [...newShapes.filter((s) => CONTAINER_TYPES.has(s.type)), ...newShapes.filter((s) => !CONTAINER_TYPES.has(s.type))];
  ordered.forEach((s, i) => (s.zIndex = i));

  const shapesRecord: Record<string, ShapeInstance> = {};
  newShapes.forEach((s) => (shapesRecord[s.id] = s));

  // Container-Zugehörigkeit geometrisch bestimmen statt über draw.ios eigenes
  // parent-Attribut (das z.B. auch reine Auswahl-Gruppen ohne fachliche
  // Bedeutung referenzieren kann) - nutzt dieselbe Logik wie beim Ablegen auf
  // dem Canvas per Drag&Drop.
  for (const shape of newShapes) {
    if (CONTAINER_TYPES.has(shape.type)) continue;
    const center = { x: shape.position.x + shape.size.width / 2, y: shape.position.y + shape.size.height / 2 };
    const containerId = findContainerAt(shapesRecord, center, shape.id);
    if (containerId) shape.parentId = containerId;
  }

  const newConnectors: ConnectorInstance[] = [];
  for (const cell of cells.values()) {
    if (!cell.isEdge || !cell.source || !cell.target) continue;
    const sourceId = idMap.get(cell.source);
    const targetId = idMap.get(cell.target);
    if (!sourceId || !targetId) continue; // Endpunkt konnte nicht aufgelöst werden (z.B. übersprungene Gruppen-Zelle)
    const sourceShape = shapesRecord[sourceId];
    const targetShape = shapesRecord[targetId];
    if (!sourceShape || !targetShape) continue;

    const sourceCenter = { x: sourceShape.position.x + sourceShape.size.width / 2, y: sourceShape.position.y + sourceShape.size.height / 2 };
    const targetCenter = { x: targetShape.position.x + targetShape.size.width / 2, y: targetShape.position.y + targetShape.size.height / 2 };
    const sourcePortId = nearestPortId(sourceShape, cell.points[0] ?? targetCenter);
    const targetPortId = nearestPortId(targetShape, cell.points[cell.points.length - 1] ?? sourceCenter);
    if (!sourcePortId || !targetPortId) continue; // z.B. Pool/Lane als Endpunkt - haben keine Ports

    newConnectors.push({
      id: generateId("conn"),
      sourceShapeId: sourceId,
      sourcePortId,
      targetShapeId: targetId,
      targetPortId,
      label: cell.value || undefined,
      connectorType: connectorTypeFor(cell.style),
      waypoints: [],
    });
  }

  const connectorsRecord: Record<string, ConnectorInstance> = {};
  newConnectors.forEach((c) => (connectorsRecord[c.id] = c));

  useCanvasStore.setState({
    shapes: shapesRecord,
    connectors: connectorsRecord,
    selectedShapeIds: [],
    selectedConnectorId: null,
  });

  return { success: true };
}
