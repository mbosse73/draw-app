import type { ShapeInstance } from "../shapes/types";

/**
 * Berechnet die Position eines Punktes auf dem Umfang eines Rechtecks anhand
 * eines Verhältnisses 0..1 (im Uhrzeigersinn, 0 = oben mittig). Genutzt für
 * Boundary Events, die "irgendwo am Rand" eines Tasks angeheftet sind.
 */
export function pointOnRectPerimeter(
  position: { x: number; y: number },
  size: { width: number; height: number },
  ratio: number
): { x: number; y: number } {
  const { width: w, height: h } = size;
  const perimeter = 2 * (w + h);
  let distance = ((ratio % 1) + 1) % 1; // auf 0..1 normalisieren
  distance *= perimeter;

  // Umfang im Uhrzeigersinn ablaufen, beginnend oben mittig: oben -> rechts -> unten -> links
  if (distance <= w / 2) {
    return { x: position.x + w / 2 + distance, y: position.y };
  }
  distance -= w / 2;
  if (distance <= h) {
    return { x: position.x + w, y: position.y + distance };
  }
  distance -= h;
  if (distance <= w) {
    return { x: position.x + w - distance, y: position.y + h };
  }
  distance -= w;
  if (distance <= h) {
    return { x: position.x, y: position.y + h - distance };
  }
  distance -= h;
  return { x: position.x + distance, y: position.y }; // letztes Stück zurück zur Startposition oben
}

/** Berechnet für einen gegebenen Weltpunkt das nächstgelegene attachmentRatio auf dem Rand einer Host-Shape. */
export function ratioForPointOnRect(
  point: { x: number; y: number },
  position: { x: number; y: number },
  size: { width: number; height: number }
): number {
  // Groben Suchraum abtasten (ausreichend fein für ein Anheften per Maus)
  const STEPS = 200;
  let bestRatio = 0;
  let bestDist = Infinity;
  for (let i = 0; i < STEPS; i++) {
    const ratio = i / STEPS;
    const p = pointOnRectPerimeter(position, size, ratio);
    const dist = Math.hypot(p.x - point.x, p.y - point.y);
    if (dist < bestDist) {
      bestDist = dist;
      bestRatio = ratio;
    }
  }
  return bestRatio;
}

/** Liefert die aktuelle Weltposition eines Boundary Events (linke obere Ecke), basierend auf der Host-Shape. */
export function getAttachedPosition(shape: ShapeInstance, host: ShapeInstance): { x: number; y: number } {
  const ratio = shape.attachmentRatio ?? 0;
  const edgePoint = pointOnRectPerimeter(host.position, host.size, ratio);
  return {
    x: edgePoint.x - shape.size.width / 2,
    y: edgePoint.y - shape.size.height / 2,
  };
}
