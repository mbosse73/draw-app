// Standard-Größen für Desktop-Wireframe-Elemente. Bewusst grobe, "low-fi"
// Standardmaße statt pixelgenauer OS-Konventionen - ein Wireframe soll früh
// und schnell entstehen, nicht bereits finales Pixel-Design sein.

export const WINDOW_SIZE = { width: 420, height: 300 };
export const DIALOG_SIZE = { width: 260, height: 160 };
export const PANEL_SIZE = { width: 220, height: 140 };
export const STRIP_SIZE = { width: 300, height: 28 }; // Menüleiste/Symbolleiste/Statusleiste/Ribbon
export const FIELD_SIZE = { width: 160, height: 30 };
export const BUTTON_SIZE = { width: 100, height: 34 };
export const SMALL_SIZE = { width: 30, height: 30 }; // Checkbox/Radio/Icon-Button
export const LIST_SIZE = { width: 220, height: 140 };
export const TEXT_SIZE = { width: 200, height: 24 };
export const PARAGRAPH_SIZE = { width: 240, height: 70 };

// Grau/monochrom statt BPMN-Indigo - macht "Wireframe" auf einen Blick von
// einem BPMN-Diagramm unterscheidbar, auch auf derselben Zeichenfläche.
// Bewusst kein eigenes handschriftliches Webfont eingebettet (Lizenz- und
// Offline-Bundling-Aufwand für zweifelhaften Zusatznutzen) - die
// handgezeichnete Optik kommt ausschließlich über die Rough.js-Linienführung
// (sketch.ts), Text bleibt in der System-Schriftart wie der Rest der App.
export const WIREFRAME_COLORS = {
  stroke: "#4a4a4a",
  strokeSelected: "var(--accent, #3d5a99)",
  text: "#333333",
  fillLight: "#f4f4f4",
  accentFill: "#8a8a8a",
};

/** Ports für rechteckige Elemente: 4 Seiten mittig - identisch zum BPMN-Modul,
 *  aber bewusst eine eigene Kopie (Module bleiben unabhängig voneinander). */
export const RECTANGLE_PORTS = [
  { id: "top", relativePosition: { x: 0.5, y: 0 } },
  { id: "right", relativePosition: { x: 1, y: 0.5 } },
  { id: "bottom", relativePosition: { x: 0.5, y: 1 } },
  { id: "left", relativePosition: { x: 0, y: 0.5 } },
];
