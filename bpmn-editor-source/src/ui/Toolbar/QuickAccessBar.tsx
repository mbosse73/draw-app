import { useCanvasStore } from "../../core/state/canvasStore";
import { undo, redo } from "../../core/state/history";
import { useHistoryStatus } from "../../core/state/useHistoryStatus";
import { useSaveLoadActions } from "./SaveLoadButtons";
import { ZoomControl } from "./ZoomControl";
import { FormatPainterButton } from "./FormatPainterButton";

/**
 * Zeile 2 des App-Headers: kompakte Icon-Leiste für die Aktionen, die man
 * beim Arbeiten ständig braucht (Undo/Redo, Speichern/Öffnen, Zoom,
 * Formatpinsel, Einrasten) - bewusst OHNE Textlabel, damit sie permanent
 * sichtbar bleibt statt Platz für ~25 einzelne Buttons zu brauchen (siehe
 * MenuBar.tsx für die vollständige, textbeschriftete Menüleiste darüber).
 */
export function QuickAccessBar() {
  const { canUndo, canRedo } = useHistoryStatus();
  const { handleSave, handleLoad } = useSaveLoadActions();
  const viewportSize = useCanvasStore((s) => s.viewportSize);
  const zoomAt = useCanvasStore((s) => s.zoomAt);
  const zoomToFit = useCanvasStore((s) => s.zoomToFit);
  const snapEnabled = useCanvasStore((s) => s.snapEnabled);

  // zoomAt() erwartet einen Bildschirmpunkt als Zoom-Anker (siehe
  // canvasStore.ts) - hier bewusst die Mitte der sichtbaren Zeichenfläche,
  // damit die Buttons sich wie ein Zoom "um die Bildmitte" anfühlen statt
  // relativ zur Fensterecke zu springen. delta>0 verkleinert (Faktor 0.9),
  // delta<0 vergrößert (Faktor 1.1) - siehe canvasStore.ts zoomAt.
  const zoomStep = (delta: number) => zoomAt(viewportSize.width / 2, viewportSize.height / 2, delta);

  return (
    <div className="toolbar quick-access-bar">
      <div className="toolbar-group">
        <button onClick={undo} disabled={!canUndo} className="icon-btn" title="Rückgängig (Strg+Z)" aria-label="Rückgängig">
          ↶
        </button>
        <button onClick={redo} disabled={!canRedo} className="icon-btn" title="Wiederholen (Strg+Y)" aria-label="Wiederholen">
          ↷
        </button>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <button onClick={handleLoad} className="icon-btn" title="Diagramm öffnen (weitere Optionen im Datei-Menü)" aria-label="Öffnen">
          📂
        </button>
        <button onClick={handleSave} className="icon-btn" title="Diagramm speichern" aria-label="Speichern">
          💾
        </button>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <button onClick={() => zoomStep(1)} className="icon-btn" title="Verkleinern" aria-label="Verkleinern">
          −
        </button>
        <ZoomControl />
        <button onClick={() => zoomStep(-1)} className="icon-btn" title="Vergrößern" aria-label="Vergrößern">
          +
        </button>
        <button onClick={() => zoomToFit()} className="icon-btn" title="An Fenster anpassen (alle Elemente sichtbar)" aria-label="An Fenster anpassen">
          ⊡
        </button>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <FormatPainterButton />
        <button
          onClick={() => useCanvasStore.setState({ snapEnabled: !snapEnabled })}
          className={snapEnabled ? "icon-btn toolbar-toggle toolbar-toggle--active" : "icon-btn toolbar-toggle"}
          aria-pressed={snapEnabled}
          aria-label="Einrasten"
          title="Am Raster einrasten ein-/ausschalten"
        >
          ⌗
        </button>
      </div>
    </div>
  );
}
