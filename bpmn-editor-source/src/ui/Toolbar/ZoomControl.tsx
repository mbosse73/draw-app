import { useState, useRef, useEffect } from "react";
import { useCanvasStore } from "../../core/state/canvasStore";

const MIN_ZOOM_PERCENT = 10;
const MAX_ZOOM_PERCENT = 400;

/** Zoom-Prozentanzeige, die sich per Klick in ein Eingabefeld verwandelt. */
export function ZoomControl() {
  const zoom = useCanvasStore((s) => s.viewport.zoom);
  const setViewport = useCanvasStore((s) => s.setViewport);
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const startEditing = () => {
    setInputValue(String(Math.round(zoom * 100)));
    setIsEditing(true);
  };

  const commit = () => {
    const parsed = parseInt(inputValue, 10);
    if (!Number.isNaN(parsed)) {
      const clamped = Math.min(MAX_ZOOM_PERCENT, Math.max(MIN_ZOOM_PERCENT, parsed));
      // Zoomt um die Mitte der sichtbaren Fläche herum, statt um den Ursprung -
      // fühlt sich beim Eintippen eines Werts natürlicher an als ein Sprung
      // relativ zur Bildschirmecke.
      setViewport({ zoom: clamped / 100 });
    }
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="number"
        className="toolbar-zoom-input"
        value={inputValue}
        min={MIN_ZOOM_PERCENT}
        max={MAX_ZOOM_PERCENT}
        onChange={(e) => setInputValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setIsEditing(false);
        }}
      />
    );
  }

  return (
    <button className="toolbar-zoom" onClick={startEditing} title="Zoom-Wert eingeben">
      {Math.round(zoom * 100)}%
    </button>
  );
}
