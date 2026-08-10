interface MultilineTextProps {
  text: string;
  x: number;
  y: number;
  fontSize?: number;
  lineHeight?: number;
  fill?: string;
  textAnchor?: "start" | "middle" | "end";
  /** Vertikale Zentrierung um y herum, statt y als erste Zeile zu behandeln */
  centerVertically?: boolean;
}

/**
 * Rendert mehrzeiligen Text in SVG. SVG <text> unterstützt \n nicht nativ,
 * daher zerlegen wir manuell in <tspan>-Zeilen.
 */
export function MultilineText({
  text,
  x,
  y,
  fontSize = 13,
  lineHeight = 1.25,
  fill = "#333333",
  textAnchor = "middle",
  centerVertically = true,
}: MultilineTextProps) {
  const lines = text.split("\n");
  const lineHeightPx = fontSize * lineHeight;
  // Bei vertikaler Zentrierung: erste Zeile so verschieben, dass der Block um y zentriert ist
  const startOffset = centerVertically ? -((lines.length - 1) * lineHeightPx) / 2 : 0;

  return (
    <text x={x} y={y} textAnchor={textAnchor} fontSize={fontSize} fill={fill} style={{ userSelect: "none", pointerEvents: "none" }}>
      {lines.map((line, i) => (
        <tspan key={i} x={x} dy={i === 0 ? startOffset : lineHeightPx}>
          {line || "\u00A0" /* Leerzeile darf nicht kollabieren */}
        </tspan>
      ))}
    </text>
  );
}
