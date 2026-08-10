import { useCanvasStore } from "../../core/state/canvasStore";
import { undo, redo } from "../../core/state/history";
import { useHistoryStatus } from "../../core/state/useHistoryStatus";
import { ExportMenu } from "./ExportMenu";
import { SaveLoadButtons } from "./SaveLoadButtons";
import { AutosaveMenu } from "./AutosaveMenu";
import { SettingsMenu } from "./SettingsMenu";
import { ZoomControl } from "./ZoomControl";
import { AutoLayoutButton } from "./AutoLayoutButton";
import { GridSizeControl } from "./GridSizeControl";
import { HelpButtons } from "../Help/HelpButtons";

interface ToolbarProps {
  onShowHelp: () => void;
  onShowShortcuts: () => void;
}

export function Toolbar({ onShowHelp, onShowShortcuts }: ToolbarProps) {
  const setViewport = useCanvasStore((s) => s.setViewport);
  const snapEnabled = useCanvasStore((s) => s.snapEnabled);
  const { canUndo, canRedo } = useHistoryStatus();

  return (
    <div className="toolbar">
      <span className="toolbar-title">BPMN Editor</span>

      <div className="toolbar-group">
        <button onClick={undo} disabled={!canUndo} title="Rückgängig (Strg+Z)" aria-label="Rückgängig">
          ↶ Undo
        </button>
        <button onClick={redo} disabled={!canRedo} title="Wiederholen (Strg+Y)" aria-label="Wiederholen">
          ↷ Redo
        </button>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <SaveLoadButtons />
        <AutosaveMenu />
        <ExportMenu />
        <SettingsMenu />
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <AutoLayoutButton />
      </div>

      <div className="toolbar-spacer" />

      <div className="toolbar-group">
        <span className="toolbar-label">Ansicht</span>
        <ZoomControl />
        <button onClick={() => setViewport({ zoom: 1, x: 0, y: 0 })} title="Zoom und Position zurücksetzen">
          Zurücksetzen
        </button>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <button
          onClick={() => useCanvasStore.setState({ snapEnabled: !snapEnabled })}
          className={snapEnabled ? "toolbar-toggle toolbar-toggle--active" : "toolbar-toggle"}
          title="Am Raster einrasten ein-/ausschalten"
          aria-pressed={snapEnabled}
        >
          Einrasten
        </button>
        <span className="toolbar-label">Rastergröße</span>
        <GridSizeControl />
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <HelpButtons onShowHelp={onShowHelp} onShowShortcuts={onShowShortcuts} />
      </div>
    </div>
  );
}
