import type { ShapeInstance, ConnectorInstance } from "../shapes/types";

/**
 * Vereinfachter Sugiyama-artiger Schichten-Layout-Algorithmus (Eigenbau, keine
 * externe Bibliothek). Ordnet Elemente nach ihrer Position im Verbindungsgraphen
 * in Spalten (Ebenen) an und verteilt sie innerhalb jeder Spalte vertikal.
 * Gedacht für "Diagramm aufräumen" per Knopfdruck - kein Anspruch auf ein
 * global optimales Layout wie ein vollausgebautes dagre/ELK, aber für typische
 * BPMN-Prozessdiagramme (Start → Tasks → Gateways → Ende) gut ausreichend.
 *
 * Ablauf:
 * 1. Ebene je Knoten bestimmen (längster Pfad vom Startknoten, longest-path layering)
 * 2. Innerhalb jeder Ebene nach der durchschnittlichen Ebene der Nachbarn sortieren
 *    (reduziert Kantenkreuzungen, "Barycenter"-Heuristik)
 * 3. Positionen aus Ebene (x) und Sortierindex (y) berechnen
 *
 * Pools/Lanes und ihre Kinder werden bewusst NICHT automatisch layoutet -
 * ihre Position ist strukturell festgelegt (Lane-Zugehörigkeit), ein
 * automatisches Verschieben würde das Containment durcheinanderbringen.
 */

const COLUMN_SPACING = 180;
const ROW_SPACING = 120;

export interface LayoutResult {
  positions: Record<string, { x: number; y: number }>;
}

export function computeAutoLayout(
  shapes: Record<string, ShapeInstance>,
  connectors: Record<string, ConnectorInstance>
): LayoutResult {
  // Nur Top-Level-Elemente layouten: keine Lane-/Pool-Kinder (parentId gesetzt),
  // keine Container selbst werden ausgeschlossen (die sind weiterhin layoutbar),
  // aber angeheftete Shapes wie Boundary Events (attachedToId gesetzt) werden
  // ausgeschlossen - sie haben keine eigenständige Position, sondern folgen
  // ihrem Host, und würden sonst fälschlich frei einsortiert.
  const layoutableIds = Object.values(shapes)
    .filter((s) => !s.parentId && !s.attachedToId)
    .map((s) => s.id);
  const layoutableSet = new Set(layoutableIds);

  if (layoutableIds.length === 0) return { positions: {} };

  // Adjazenzlisten nur über Verbindungen zwischen layoutbaren Knoten.
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();
  layoutableIds.forEach((id) => {
    outgoing.set(id, []);
    incoming.set(id, []);
  });
  for (const c of Object.values(connectors)) {
    if (layoutableSet.has(c.sourceShapeId) && layoutableSet.has(c.targetShapeId)) {
      outgoing.get(c.sourceShapeId)!.push(c.targetShapeId);
      incoming.get(c.targetShapeId)!.push(c.sourceShapeId);
    }
  }

  // --- Schritt 1: Ebenen bestimmen (longest-path layering) ---
  // Startknoten = keine eingehenden Kanten. Von dort aus die längste
  // Entfernung zu jedem erreichbaren Knoten bestimmen (Kahn-artiger Ansatz,
  // mit Zyklus-Schutz für den unwahrscheinlichen Fall eines Kreises im Diagramm).
  const layer = new Map<string, number>();
  const roots = layoutableIds.filter((id) => incoming.get(id)!.length === 0);
  const startNodes = roots.length > 0 ? roots : [layoutableIds[0]]; // Fallback falls alles einen Vorgänger hat (Zyklus)

  startNodes.forEach((id) => layer.set(id, 0));
  let changed = true;
  let iterations = 0;
  const MAX_ITERATIONS = layoutableIds.length * 4; // grobzügiges Limit gegen Endlosschleifen bei Zyklen
  while (changed && iterations < MAX_ITERATIONS) {
    changed = false;
    iterations++;
    for (const id of layoutableIds) {
      const preds = incoming.get(id)!;
      if (preds.length === 0) {
        if (!layer.has(id)) {
          layer.set(id, 0);
          changed = true;
        }
        continue;
      }
      const predLayers = preds.map((p) => layer.get(p)).filter((l): l is number => l !== undefined);
      if (predLayers.length === 0) continue;
      const proposed = Math.max(...predLayers) + 1;
      if (layer.get(id) === undefined || proposed > layer.get(id)!) {
        layer.set(id, proposed);
        changed = true;
      }
    }
  }
  // Knoten, die durch Zyklen nie erreicht wurden, ans Ende setzen statt sie zu verlieren.
  layoutableIds.forEach((id) => {
    if (!layer.has(id)) layer.set(id, 0);
  });

  // --- Schritt 2: Knoten je Ebene gruppieren ---
  const layerGroups = new Map<number, string[]>();
  for (const id of layoutableIds) {
    const l = layer.get(id)!;
    if (!layerGroups.has(l)) layerGroups.set(l, []);
    layerGroups.get(l)!.push(id);
  }

  // --- Schritt 3: Innerhalb jeder Ebene nach Barycenter der Vorgänger sortieren ---
  // (reduziert Kantenkreuzungen ohne die Komplexität eines vollen Kreuzungs-Minimierers)
  const order = new Map<string, number>(); // vorläufiger Index innerhalb der eigenen Ebene
  const sortedLayerNumbers = Array.from(layerGroups.keys()).sort((a, b) => a - b);
  for (const l of sortedLayerNumbers) {
    const nodes = layerGroups.get(l)!;
    if (l === 0) {
      // Erste Ebene: stabil nach ID sortieren für ein deterministisches Ergebnis
      nodes.sort();
    } else {
      nodes.sort((a, b) => {
        const aPreds = incoming.get(a)!.map((p) => order.get(p) ?? 0);
        const bPreds = incoming.get(b)!.map((p) => order.get(p) ?? 0);
        const aAvg = aPreds.length > 0 ? aPreds.reduce((s, v) => s + v, 0) / aPreds.length : 0;
        const bAvg = bPreds.length > 0 ? bPreds.reduce((s, v) => s + v, 0) / bPreds.length : 0;
        return aAvg - bAvg;
      });
    }
    nodes.forEach((id, i) => order.set(id, i));
  }

  // --- Schritt 4: Positionen berechnen ---
  const positions: Record<string, { x: number; y: number }> = {};
  for (const l of sortedLayerNumbers) {
    const nodes = layerGroups.get(l)!;
    // Größte Höhe in dieser Spalte als Basis für den Row-Abstand nutzen,
    // damit große Elemente (Pools wären hier ausgeschlossen, aber z.B.
    // Datenobjekte mit anderer Höhe) sich nicht überlappen.
    let cursorY = 0;
    for (const id of nodes) {
      const shape = shapes[id];
      positions[id] = { x: l * COLUMN_SPACING, y: cursorY };
      cursorY += shape.size.height + ROW_SPACING;
    }
  }

  return { positions };
}
