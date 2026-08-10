import { useCanvasStore } from "../../core/state/canvasStore";

const GRID_SIZE_OPTIONS = [10, 15, 20, 25, 30, 40, 50];

/** Dropdown zur Auswahl der Raster-Größe (Grid-Snapping-Schrittweite). */
export function GridSizeControl() {
  const gridSize = useCanvasStore((s) => s.gridSize);

  return (
    <select
      className="toolbar-grid-select"
      value={gridSize}
      onChange={(e) => useCanvasStore.setState({ gridSize: Number(e.target.value) })}
      title="Raster-Größe"
    >
      {GRID_SIZE_OPTIONS.map((size) => (
        <option key={size} value={size}>
          {size}px
        </option>
      ))}
    </select>
  );
}
