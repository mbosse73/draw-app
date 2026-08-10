import type { ShapeInstance, Point } from "../shapes/types";

/**
 * Grid-basiertes A*-Routing für orthogonale Verbindungslinien, die anderen
 * Shapes ausweichen. Arbeitet auf einem groben Raster (nicht dem Anzeige-Grid),
 * um die Suche performant zu halten - für ein Diagramm-Tool reicht diese
 * Auflösung völlig aus und bleibt auch bei 100+ Elementen schnell genug.
 */

const CELL_SIZE = 15; // Raster-Auflösung für die Pfadsuche (Weltkoordinaten)
const OBSTACLE_MARGIN = 8; // Sicherheitsabstand um Shapes, damit Linien nicht direkt an Kanten kleben
const MAX_SEARCH_NODES = 8000; // Sicherheitslimit gegen Endlossuche bei großen/komplexen Layouts

interface GridBounds {
  minX: number;
  minY: number;
  cols: number;
  rows: number;
}

function toGrid(point: Point, bounds: GridBounds): { col: number; row: number } {
  return {
    col: Math.round((point.x - bounds.minX) / CELL_SIZE),
    row: Math.round((point.y - bounds.minY) / CELL_SIZE),
  };
}

function toWorld(col: number, row: number, bounds: GridBounds): Point {
  return { x: bounds.minX + col * CELL_SIZE, y: bounds.minY + row * CELL_SIZE };
}

/** Baut eine Menge blockierter Zellen aus allen Shapes außer den beiden Endpunkt-Shapes. */
function buildObstacleGrid(
  shapes: Record<string, ShapeInstance>,
  excludeShapeIds: Set<string>,
  bounds: GridBounds
): Set<string> {
  const blocked = new Set<string>();
  for (const shape of Object.values(shapes)) {
    if (excludeShapeIds.has(shape.id)) continue;
    // Container (Pool/Lane) selbst nicht als Hindernis behandeln - sie sind
    // meist großflächig und Verbindungen laufen ohnehin oft durch sie hindurch
    // (Elemente innerhalb derselben Lane). Nur "echte" Inhalte blockieren.
    const minCol = Math.floor((shape.position.x - OBSTACLE_MARGIN - bounds.minX) / CELL_SIZE);
    const maxCol = Math.ceil((shape.position.x + shape.size.width + OBSTACLE_MARGIN - bounds.minX) / CELL_SIZE);
    const minRow = Math.floor((shape.position.y - OBSTACLE_MARGIN - bounds.minY) / CELL_SIZE);
    const maxRow = Math.ceil((shape.position.y + shape.size.height + OBSTACLE_MARGIN - bounds.minY) / CELL_SIZE);
    for (let c = minCol; c <= maxCol; c++) {
      for (let r = minRow; r <= maxRow; r++) {
        blocked.add(`${c},${r}`);
      }
    }
  }
  return blocked;
}

interface AStarNode {
  col: number;
  row: number;
  g: number; // Kosten vom Start
  f: number; // g + Heuristik
  parent: AStarNode | null;
  // Richtung, aus der die Zelle erreicht wurde - für den "Kurven kosten mehr"-Bonus,
  // damit A* möglichst gerade Linien statt Zickzack bevorzugt.
  dir: "h" | "v" | null;
}

function heuristic(a: { col: number; row: number }, b: { col: number; row: number }): number {
  return Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
}

/**
 * Sucht einen orthogonalen (Manhattan-)Pfad von `from` nach `to`, der
 * blockierten Zellen ausweicht. Fällt auf eine direkte orthogonale Linie
 * zurück, falls A* kein Ergebnis findet (z.B. Start/Ziel selbst blockiert,
 * oder das Suchlimit wurde erreicht) - eine Verbindung soll nie ganz fehlen.
 */
export function findRoutedPath(
  from: Point,
  to: Point,
  shapes: Record<string, ShapeInstance>,
  excludeShapeIds: Set<string>
): Point[] {
  const bounds: GridBounds = {
    minX: Math.min(from.x, to.x) - 200,
    minY: Math.min(from.y, to.y) - 200,
    cols: 0,
    rows: 0,
  };
  bounds.cols = Math.ceil((Math.max(from.x, to.x) + 200 - bounds.minX) / CELL_SIZE);
  bounds.rows = Math.ceil((Math.max(from.y, to.y) + 200 - bounds.minY) / CELL_SIZE);

  const blocked = buildObstacleGrid(shapes, excludeShapeIds, bounds);
  const start = toGrid(from, bounds);
  const goal = toGrid(to, bounds);

  // Start/Ziel selbst dürfen nicht als blockiert gelten (sie liegen direkt
  // am Rand der Quell-/Ziel-Shape, die ja bewusst ausgeschlossen ist).
  const key = (c: number, r: number) => `${c},${r}`;

  const open: AStarNode[] = [{ col: start.col, row: start.row, g: 0, f: heuristic(start, goal), parent: null, dir: null }];
  const bestG = new Map<string, number>();
  bestG.set(key(start.col, start.row), 0);
  let visited = 0;

  while (open.length > 0 && visited < MAX_SEARCH_NODES) {
    // Einfache lineare Suche nach dem besten f-Wert (kein Heap nötig bei
    // diesen Diagrammgrößen - Klarheit vor Mikro-Optimierung).
    let bestIdx = 0;
    for (let i = 1; i < open.length; i++) {
      if (open[i].f < open[bestIdx].f) bestIdx = i;
    }
    const current = open.splice(bestIdx, 1)[0];
    visited++;

    if (current.col === goal.col && current.row === goal.row) {
      return reconstructPath(current, bounds, from, to);
    }

    const neighbors: Array<{ col: number; row: number; dir: "h" | "v" }> = [
      { col: current.col + 1, row: current.row, dir: "h" },
      { col: current.col - 1, row: current.row, dir: "h" },
      { col: current.col, row: current.row + 1, dir: "v" },
      { col: current.col, row: current.row - 1, dir: "v" },
    ];

    for (const n of neighbors) {
      if (n.col < 0 || n.row < 0 || n.col > bounds.cols || n.row > bounds.rows) continue;
      const k = key(n.col, n.row);
      if (blocked.has(k) && !(n.col === goal.col && n.row === goal.row)) continue;

      // Kleiner Aufpreis bei Richtungswechsel, damit A* gerade Strecken
      // bevorzugt statt unnötig zu mäandern.
      const turnPenalty = current.dir && current.dir !== n.dir ? 0.5 : 0;
      const tentativeG = current.g + 1 + turnPenalty;

      if (bestG.has(k) && bestG.get(k)! <= tentativeG) continue;
      bestG.set(k, tentativeG);
      open.push({
        col: n.col,
        row: n.row,
        g: tentativeG,
        f: tentativeG + heuristic(n, goal),
        parent: current,
        dir: n.dir,
      });
    }
  }

  // Kein Pfad gefunden (oder Suchlimit erreicht): einfacher direkter
  // orthogonaler Fallback, damit die Verbindung nie ganz verschwindet.
  return fallbackOrthogonalPath(from, to);
}

function reconstructPath(node: AStarNode, bounds: GridBounds, from: Point, to: Point): Point[] {
  const cells: Array<{ col: number; row: number }> = [];
  let current: AStarNode | null = node;
  while (current) {
    cells.push({ col: current.col, row: current.row });
    current = current.parent;
  }
  cells.reverse();

  // Kollineare Zwischenpunkte entfernen, damit nur an echten Richtungswechseln
  // ein Wegpunkt entsteht (sonst hätten wir hunderte Mini-Segmente).
  const simplified: Point[] = [];
  for (let i = 0; i < cells.length; i++) {
    const world = toWorld(cells[i].col, cells[i].row, bounds);
    if (simplified.length < 2) {
      simplified.push(world);
      continue;
    }
    const prev = simplified[simplified.length - 1];
    const prevPrev = simplified[simplified.length - 2];
    const sameDirectionAsBefore =
      (prevPrev.x === prev.x && prev.x === world.x) || (prevPrev.y === prev.y && prev.y === world.y);
    if (sameDirectionAsBefore) {
      simplified[simplified.length - 1] = world; // letzten Punkt verlängern statt neuen Knick einzufügen
    } else {
      simplified.push(world);
    }
  }

  // Start-/Zielzelle sind auf das grobe CELL_SIZE-Raster gerundet (toGrid),
  // weichen also i.d.R. einige Pixel vom exakten Port ab (Symmetriepunkt/
  // Rand der Shape). Endpunkte hier auf die exakten Weltkoordinaten zurück-
  // setzen, sonst dockt die Pfeilspitze sichtbar versetzt statt exakt an -
  // ein früherer, real gemeldeter Bug (siehe probleme.png).
  if (simplified.length < 2) return [from, to];
  simplified[0] = from;
  simplified[simplified.length - 1] = to;
  return simplified;
}

function fallbackOrthogonalPath(from: Point, to: Point): Point[] {
  const dx = Math.abs(to.x - from.x);
  const dy = Math.abs(to.y - from.y);
  if (dx < 10 || dy < 10) return [from, to];
  const midX = from.x + (to.x - from.x) / 2;
  return [from, { x: midX, y: from.y }, { x: midX, y: to.y }, to];
}
