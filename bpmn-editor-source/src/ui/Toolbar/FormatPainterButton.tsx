import { useCanvasStore } from "../../core/state/canvasStore";

/** Formatpinsel (Z-14): kopiert den visuellen Stil der aktuell selektierten
 *  Shape ODER Verbindung (beide werden unterstützt, siehe
 *  `formatPainterClipboard` im Store - Selektion von Shape/Verbindung
 *  schließt sich im Store ohnehin gegenseitig aus, daher reicht ein
 *  einfaches "Verbindung bevorzugen, falls selektiert") und wartet auf
 *  einen Klick auf ein gleichartiges Ziel, um ihn dort anzuwenden (siehe
 *  copyFormatFromShape/copyFormatFromConnector/applyFormatPainterTo* im
 *  Store, Anwendung des Klicks in CanvasEngine.tsx). */
export function FormatPainterButton() {
  const selectedShapeIds = useCanvasStore((s) => s.selectedShapeIds);
  const selectedConnectorId = useCanvasStore((s) => s.selectedConnectorId);
  const formatPainterClipboard = useCanvasStore((s) => s.formatPainterClipboard);
  const copyFormatFromShape = useCanvasStore((s) => s.copyFormatFromShape);
  const copyFormatFromConnector = useCanvasStore((s) => s.copyFormatFromConnector);
  const cancelFormatPainter = useCanvasStore((s) => s.cancelFormatPainter);

  const isActive = formatPainterClipboard !== null;
  const canCopy = selectedShapeIds.length >= 1 || Boolean(selectedConnectorId);

  return (
    <button
      onClick={() => {
        if (isActive) cancelFormatPainter();
        else if (selectedConnectorId) copyFormatFromConnector(selectedConnectorId);
        else if (selectedShapeIds.length > 0) copyFormatFromShape(selectedShapeIds[0]);
      }}
      disabled={!isActive && !canCopy}
      className={isActive ? "icon-btn toolbar-toggle toolbar-toggle--active" : "icon-btn toolbar-toggle"}
      aria-pressed={isActive}
      title="Formatpinsel: Stil kopieren, dann auf ein gleichartiges Element (Shape/Verbindung) klicken (Escape zum Abbrechen)"
      aria-label="Formatpinsel"
    >
      🖌
    </button>
  );
}
