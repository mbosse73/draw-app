import type { ShapeInstance } from "../shapes/types";

export interface AlignmentGuide {
  orientation: "vertical" | "horizontal";
  position: number;
  from: number;
  to: number;
}

const SNAP_TOLERANCE = 6;

interface EdgeSet {
  verticalLines: { position: number; from: number; to: number }[];
  horizontalLines: { position: number; from: number; to: number }[];
}

function collectEdges(shape: ShapeInstance): EdgeSet {
  const { x, y } = shape.position;
  const { width: w, height: h } = shape.size;
  return {
    verticalLines: [
      { position: x, from: y, to: y + h },
      { position: x + w / 2, from: y, to: y + h },
      { position: x + w, from: y, to: y + h },
    ],
    horizontalLines: [
      { position: y, from: x, to: x + w },
      { position: y + h / 2, from: x, to: x + w },
      { position: y + h, from: x, to: x + w },
    ],
  };
}

export function computeAlignmentGuides(
  movingShapeId: string,
  candidatePosition: { x: number; y: number },
  size: { width: number; height: number },
  allShapes: Record<string, ShapeInstance>
): { guides: AlignmentGuide[]; snappedPosition: { x: number; y: number } } {
  const guides: AlignmentGuide[] = [];
  let snappedX = candidatePosition.x;
  let snappedY = candidatePosition.y;

  const movingEdgesX = [candidatePosition.x, candidatePosition.x + size.width / 2, candidatePosition.x + size.width];
  const movingEdgesY = [candidatePosition.y, candidatePosition.y + size.height / 2, candidatePosition.y + size.height];

  let bestXDelta = SNAP_TOLERANCE + 1;
  let bestYDelta = SNAP_TOLERANCE + 1;

  for (const other of Object.values(allShapes)) {
    if (other.id === movingShapeId) continue;
    const otherEdges = collectEdges(other);

    for (const vLine of otherEdges.verticalLines) {
      for (const movingX of movingEdgesX) {
        const delta = Math.abs(movingX - vLine.position);
        if (delta <= SNAP_TOLERANCE) {
          const from = Math.min(vLine.from, candidatePosition.y);
          const to = Math.max(vLine.to, candidatePosition.y + size.height);
          guides.push({ orientation: "vertical", position: vLine.position, from, to });
          if (delta < bestXDelta) {
            bestXDelta = delta;
            snappedX = candidatePosition.x + (vLine.position - movingX);
          }
        }
      }
    }

    for (const hLine of otherEdges.horizontalLines) {
      for (const movingY of movingEdgesY) {
        const delta = Math.abs(movingY - hLine.position);
        if (delta <= SNAP_TOLERANCE) {
          const from = Math.min(hLine.from, candidatePosition.x);
          const to = Math.max(hLine.to, candidatePosition.x + size.width);
          guides.push({ orientation: "horizontal", position: hLine.position, from, to });
          if (delta < bestYDelta) {
            bestYDelta = delta;
            snappedY = candidatePosition.y + (hLine.position - movingY);
          }
        }
      }
    }
  }

  return { guides, snappedPosition: { x: snappedX, y: snappedY } };
}
