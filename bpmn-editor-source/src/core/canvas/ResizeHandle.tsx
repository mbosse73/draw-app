interface ResizeHandleProps {
  width: number;
  height: number;
  onResizeStart: (e: React.MouseEvent) => void;
}

const HANDLE_SIZE = 10;

/** Kleiner Ziehgriff unten rechts an einer Shape, zum Ändern der Größe. */
export function ResizeHandle({ width, height, onResizeStart }: ResizeHandleProps) {
  return (
    <rect
      x={width - HANDLE_SIZE / 2}
      y={height - HANDLE_SIZE / 2}
      width={HANDLE_SIZE}
      height={HANDLE_SIZE}
      fill="var(--accent, #3d5a99)"
      stroke="#ffffff"
      strokeWidth={1}
      style={{ cursor: "nwse-resize" }}
      onMouseDown={(e) => {
        e.stopPropagation();
        onResizeStart(e);
      }}
    />
  );
}
