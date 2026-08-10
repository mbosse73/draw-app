import type { AlignmentGuide } from "./alignmentGuides";

export function AlignmentGuidesLayer({ guides }: { guides: AlignmentGuide[] }) {
  if (guides.length === 0) return null;
  return (
    <g className="alignment-guides" style={{ pointerEvents: "none" }}>
      {guides.map((guide, i) =>
        guide.orientation === "vertical" ? (
          <line
            key={i}
            x1={guide.position}
            y1={guide.from}
            x2={guide.position}
            y2={guide.to}
            stroke="#ff4d6d"
            strokeWidth={1}
            strokeDasharray="4 3"
          />
        ) : (
          <line
            key={i}
            x1={guide.from}
            y1={guide.position}
            x2={guide.to}
            y2={guide.position}
            stroke="#ff4d6d"
            strokeWidth={1}
            strokeDasharray="4 3"
          />
        )
      )}
    </g>
  );
}
