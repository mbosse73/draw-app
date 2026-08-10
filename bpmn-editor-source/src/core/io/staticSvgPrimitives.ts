/**
 * Bausteine für die statische SVG-Ausgabe (Bild-Export), die ALLE Module
 * gemeinsam brauchen - reine String-Erzeugung, ohne DOM und ohne React.
 *
 * Bewusst hier im Core und nicht in einem Modul: Sie enthalten kein Wissen
 * über einen bestimmten Diagrammtyp, sondern nur allgemeine SVG-Mechanik
 * (Escaping, mehrzeiliger Text). Die eigentliche "Wie sieht dieses Shape
 * aus"-Logik liegt dagegen in den Modulen (siehe
 * ShapeRegistry.setStaticSvgRenderer).
 */

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Mehrzeiliger Text als `<text>` mit `<tspan>`-Zeilen - das String-Pendant zur
 * Live-Komponente `core/canvas/MultilineText.tsx`.
 *
 * `centerVertically` und `anchor` müssen zu den Werten der jeweiligen
 * Live-Komponente passen. Linksbündige Beschriftungen (Listen-, Tabellen-,
 * Formularzeilen) rutschen sonst im Export in die Mitte und überlappen ihr
 * Bedienelement - genau dieser Unterschied war 2026 bei 15 Shape-Typen
 * unbemerkt eingerissen. Abgesichert durch `npm run check:export`.
 */
export function multilineTextMarkup(
  text: string,
  x: number,
  y: number,
  fill: string,
  fontSize: number,
  centerVertically = true,
  anchor: "start" | "middle" | "end" = "middle"
): string {
  const lines = text.split("\n");
  const lineHeight = fontSize * 1.25;
  const startOffset = centerVertically ? -((lines.length - 1) * lineHeight) / 2 : 0;
  const tspans = lines
    .map((line, i) => `<tspan x="${x}" dy="${i === 0 ? startOffset : lineHeight}">${escapeXml(line) || "&#160;"}</tspan>`)
    .join("");
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="${fontSize}" fill="${fill}" font-family="sans-serif">${tspans}</text>`;
}
