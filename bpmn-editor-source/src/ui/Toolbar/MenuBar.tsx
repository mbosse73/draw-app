import { useState } from "react";
import { useCanvasStore } from "../../core/state/canvasStore";
import { undo, redo, pushHistorySnapshot } from "../../core/state/history";
import { useHistoryStatus } from "../../core/state/useHistoryStatus";
import { copySelectionToClipboard, pasteClipboard, hasClipboardContent } from "../../core/state/clipboard";
import { TopMenu } from "./TopMenu";
import { useSaveLoadActions } from "./SaveLoadButtons";
import { ExportMenu } from "./ExportMenu";
import { AutosaveMenu } from "./AutosaveMenu";
import { SettingsMenu } from "./SettingsMenu";
import { AutoLayoutButton } from "./AutoLayoutButton";
import { GridSizeControl } from "./GridSizeControl";
import { HelpButtons } from "../Help/HelpButtons";
import { ThemeToggleButton } from "../Theme/ThemeToggleButton";

interface MenuBarProps {
  onShowHelp: () => void;
  onShowShortcuts: () => void;
  onShowLibrary: () => void;
}

/** Rechtsbündiger Tastaturkürzel-Hinweis in einem Menüeintrag, analog zu
 *  nativen App-Menüs - rein informativ, das Kürzel selbst wird weiterhin
 *  ausschließlich in CanvasEngine.tsx (bzw. App.tsx für F1) behandelt; siehe
 *  auch ShortcutOverlay.tsx für die vollständige Liste. */
function Shortcut({ children }: { children: string }) {
  return <span className="menu-shortcut">{children}</span>;
}

/**
 * Zeile 1 des App-Headers: klassische Menüleiste (Datei/Bearbeiten/Ansicht/
 * Anordnen/Hilfe) statt der vormals ~25 flachen Toolbar-Buttons in einer
 * einzigen Reihe (siehe QuickAccessBar.tsx für Zeile 2, die häufigsten
 * Aktionen bleiben dort als Icons permanent sichtbar). Jedes Dropdown holt
 * sich seine Aktionen direkt aus dem Store - analog zum Aufbau des
 * Rechtsklick-Kontextmenüs in CanvasEngine.tsx.
 */
export function MenuBar({ onShowHelp, onShowShortcuts, onShowLibrary }: MenuBarProps) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const close = () => setOpenMenu(null);

  const { handleSave, handleLoad, handleLoadDrawio } = useSaveLoadActions();
  const { canUndo, canRedo } = useHistoryStatus();

  const selectedShapeIds = useCanvasStore((s) => s.selectedShapeIds);
  const selectedConnectorId = useCanvasStore((s) => s.selectedConnectorId);
  const shapes = useCanvasStore((s) => s.shapes);
  const removeShape = useCanvasStore((s) => s.removeShape);
  const removeConnector = useCanvasStore((s) => s.removeConnector);
  const selectShapes = useCanvasStore((s) => s.selectShapes);
  const zoomToFit = useCanvasStore((s) => s.zoomToFit);
  const zoomToSelection = useCanvasStore((s) => s.zoomToSelection);
  const setViewport = useCanvasStore((s) => s.setViewport);
  const showPagePreview = useCanvasStore((s) => s.showPagePreview);
  const togglePagePreview = useCanvasStore((s) => s.togglePagePreview);
  const snapEnabled = useCanvasStore((s) => s.snapEnabled);
  const alignShapes = useCanvasStore((s) => s.alignShapes);
  const distributeShapes = useCanvasStore((s) => s.distributeShapes);
  const matchShapeSizes = useCanvasStore((s) => s.matchShapeSizes);
  const flipShapes = useCanvasStore((s) => s.flipShapes);
  const groupShapes = useCanvasStore((s) => s.groupShapes);
  const ungroupShapes = useCanvasStore((s) => s.ungroupShapes);

  const hasSelection = selectedShapeIds.length > 0 || Boolean(selectedConnectorId);
  const canAlign = selectedShapeIds.length >= 2;
  const canDistribute = selectedShapeIds.length >= 3;
  const canGroup = selectedShapeIds.length >= 2;
  const canUngroup = selectedShapeIds.some((id) => shapes[id]?.groupId);

  const handleDelete = () => {
    selectedShapeIds.forEach((id) => {
      if (!shapes[id]?.locked) removeShape(id);
    });
    if (selectedConnectorId) removeConnector(selectedConnectorId);
    pushHistorySnapshot();
  };

  const handleDuplicate = () => {
    copySelectionToClipboard();
    pasteClipboard();
    pushHistorySnapshot();
  };

  return (
    <div className="menubar">
      <span className="menubar-title">BPMN Editor</span>

      <TopMenu id="datei" label="Datei" openMenu={openMenu} onOpen={setOpenMenu} onClose={close} dropdownClassName="menubar-dropdown--has-flyout">
        {(closeMenu) => (
          <>
            <button onClick={() => { handleLoad(); closeMenu(); }}>Öffnen…</button>
            <button onClick={() => { handleLoadDrawio(); closeMenu(); }}>draw.io importieren…</button>
            <button onClick={() => { handleSave(); closeMenu(); }}>Speichern</button>
            <div className="toolbar-menu-divider" />
            <button onClick={() => { onShowLibrary(); closeMenu(); }}>Bibliothek…</button>
            <div className="toolbar-menu-divider" />
            <div className="menu-flyout">
              <ExportMenu />
            </div>
            <div className="menu-flyout">
              <AutosaveMenu />
            </div>
          </>
        )}
      </TopMenu>

      <TopMenu id="bearbeiten" label="Bearbeiten" openMenu={openMenu} onOpen={setOpenMenu} onClose={close}>
        {(closeMenu) => (
          <>
            <button onClick={() => { undo(); closeMenu(); }} disabled={!canUndo}>
              Rückgängig <Shortcut>Strg+Z</Shortcut>
            </button>
            <button onClick={() => { redo(); closeMenu(); }} disabled={!canRedo}>
              Wiederholen <Shortcut>Strg+Y</Shortcut>
            </button>
            <div className="toolbar-menu-divider" />
            <button onClick={() => { copySelectionToClipboard(); closeMenu(); }} disabled={selectedShapeIds.length === 0}>
              Kopieren <Shortcut>Strg+C</Shortcut>
            </button>
            <button
              onClick={() => { pasteClipboard(); pushHistorySnapshot(); closeMenu(); }}
              disabled={!hasClipboardContent()}
            >
              Einfügen <Shortcut>Strg+V</Shortcut>
            </button>
            <button onClick={() => { handleDuplicate(); closeMenu(); }} disabled={selectedShapeIds.length === 0}>
              Duplizieren
            </button>
            <button onClick={() => { handleDelete(); closeMenu(); }} disabled={!hasSelection}>
              Löschen <Shortcut>Entf</Shortcut>
            </button>
            <div className="toolbar-menu-divider" />
            <button onClick={() => { selectShapes(Object.keys(useCanvasStore.getState().shapes)); closeMenu(); }}>
              Alles auswählen <Shortcut>Strg+A</Shortcut>
            </button>
          </>
        )}
      </TopMenu>

      <TopMenu id="ansicht" label="Ansicht" openMenu={openMenu} onOpen={setOpenMenu} onClose={close}>
        {(closeMenu) => (
          <>
            <button onClick={() => { zoomToFit(); closeMenu(); }}>An Fenster anpassen</button>
            <button onClick={() => { zoomToSelection(); closeMenu(); }} disabled={selectedShapeIds.length === 0}>
              Auswahl zoomen
            </button>
            <button onClick={() => { setViewport({ zoom: 1, x: 0, y: 0 }); closeMenu(); }}>Zoom zurücksetzen</button>
            <div className="toolbar-menu-divider" />
            <button onClick={() => togglePagePreview()}>
              {showPagePreview ? "✓ Druckseiten-Vorschau" : "Druckseiten-Vorschau"}
            </button>
            <div className="toolbar-menu-divider" />
            <button onClick={() => useCanvasStore.setState({ snapEnabled: !snapEnabled })}>
              {snapEnabled ? "✓ Am Raster einrasten" : "Am Raster einrasten"}
            </button>
            <div className="menubar-row-item">
              <span>Rastergröße</span>
              <GridSizeControl />
            </div>
          </>
        )}
      </TopMenu>

      <TopMenu id="anordnen" label="Anordnen" openMenu={openMenu} onOpen={setOpenMenu} onClose={close}>
        {(closeMenu) => (
          <>
            <div className="menubar-full-row" onClick={closeMenu}>
              <AutoLayoutButton />
            </div>
            <div className="toolbar-menu-divider" />
            <button disabled={!canAlign} onClick={() => { alignShapes(selectedShapeIds, "left"); pushHistorySnapshot(); closeMenu(); }}>
              Links ausrichten
            </button>
            <button disabled={!canAlign} onClick={() => { alignShapes(selectedShapeIds, "centerH"); pushHistorySnapshot(); closeMenu(); }}>
              Horizontal zentrieren
            </button>
            <button disabled={!canAlign} onClick={() => { alignShapes(selectedShapeIds, "right"); pushHistorySnapshot(); closeMenu(); }}>
              Rechts ausrichten
            </button>
            <button disabled={!canAlign} onClick={() => { alignShapes(selectedShapeIds, "top"); pushHistorySnapshot(); closeMenu(); }}>
              Oben ausrichten
            </button>
            <button disabled={!canAlign} onClick={() => { alignShapes(selectedShapeIds, "middleV"); pushHistorySnapshot(); closeMenu(); }}>
              Vertikal zentrieren
            </button>
            <button disabled={!canAlign} onClick={() => { alignShapes(selectedShapeIds, "bottom"); pushHistorySnapshot(); closeMenu(); }}>
              Unten ausrichten
            </button>
            <div className="toolbar-menu-divider" />
            <button
              disabled={!canDistribute}
              onClick={() => { distributeShapes(selectedShapeIds, "horizontal"); pushHistorySnapshot(); closeMenu(); }}
            >
              Horizontal verteilen
            </button>
            <button
              disabled={!canDistribute}
              onClick={() => { distributeShapes(selectedShapeIds, "vertical"); pushHistorySnapshot(); closeMenu(); }}
            >
              Vertikal verteilen
            </button>
            <div className="toolbar-menu-divider" />
            <button disabled={!canAlign} onClick={() => { matchShapeSizes(selectedShapeIds, "width"); pushHistorySnapshot(); closeMenu(); }}>
              Breite angleichen
            </button>
            <button disabled={!canAlign} onClick={() => { matchShapeSizes(selectedShapeIds, "height"); pushHistorySnapshot(); closeMenu(); }}>
              Höhe angleichen
            </button>
            <button disabled={!canAlign} onClick={() => { matchShapeSizes(selectedShapeIds, "both"); pushHistorySnapshot(); closeMenu(); }}>
              Größe angleichen (beides)
            </button>
            <div className="toolbar-menu-divider" />
            <button
              disabled={selectedShapeIds.length === 0}
              onClick={() => { flipShapes(selectedShapeIds, "horizontal"); pushHistorySnapshot(); closeMenu(); }}
            >
              Horizontal spiegeln
            </button>
            <button
              disabled={selectedShapeIds.length === 0}
              onClick={() => { flipShapes(selectedShapeIds, "vertical"); pushHistorySnapshot(); closeMenu(); }}
            >
              Vertikal spiegeln
            </button>
            <div className="toolbar-menu-divider" />
            <button disabled={!canGroup} onClick={() => { groupShapes(selectedShapeIds); pushHistorySnapshot(); closeMenu(); }}>
              Elemente gruppieren <Shortcut>Strg+G</Shortcut>
            </button>
            <button disabled={!canUngroup} onClick={() => { ungroupShapes(selectedShapeIds); pushHistorySnapshot(); closeMenu(); }}>
              Gruppierung aufheben <Shortcut>Strg+Shift+G</Shortcut>
            </button>
          </>
        )}
      </TopMenu>

      <TopMenu id="hilfe" label="Hilfe" openMenu={openMenu} onOpen={setOpenMenu} onClose={close}>
        {() => <HelpButtons onShowHelp={onShowHelp} onShowShortcuts={onShowShortcuts} />}
      </TopMenu>

      <div className="menubar-spacer" />
      <SettingsMenu />
      <ThemeToggleButton />
    </div>
  );
}
