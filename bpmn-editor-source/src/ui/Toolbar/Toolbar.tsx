import { MenuBar } from "./MenuBar";
import { QuickAccessBar } from "./QuickAccessBar";

interface ToolbarProps {
  onShowHelp: () => void;
  onShowShortcuts: () => void;
  onShowLibrary: () => void;
}

/**
 * Zweizeiliger App-Header: Menüleiste (Datei/Bearbeiten/Ansicht/Anordnen/
 * Hilfe, siehe MenuBar.tsx) + Schnellzugriffsleiste (häufige Aktionen als
 * Icons, siehe QuickAccessBar.tsx). App.tsx kennt weiterhin nur diese eine
 * `<Toolbar>`-Komponente - die Zweiteilung ist ein internes
 * Implementierungsdetail.
 */
export function Toolbar({ onShowHelp, onShowShortcuts, onShowLibrary }: ToolbarProps) {
  return (
    <>
      <MenuBar onShowHelp={onShowHelp} onShowShortcuts={onShowShortcuts} onShowLibrary={onShowLibrary} />
      <QuickAccessBar />
    </>
  );
}
