import { useEffect, useState } from "react";
import { CanvasEngine } from "./core/canvas/CanvasEngine";
import { Toolbox } from "./ui/Toolbox/Toolbox";
import { PropertiesPanel } from "./ui/PropertiesPanel/PropertiesPanel";
import { Toolbar } from "./ui/Toolbar/Toolbar";
import { RestorePrompt } from "./ui/Autosave/RestorePrompt";
import { HelpOverlay } from "./ui/Help/HelpOverlay";
import { ShortcutOverlay } from "./ui/Help/ShortcutOverlay";
import { LibraryPanel } from "./ui/Library/LibraryPanel";
import { ToastStack } from "./ui/Toast/ToastStack";
import { useThemeStore } from "./ui/Theme/themeStore";
import { registerBpmnModule } from "./modules/bpmn";
import { registerWireframeModule } from "./modules/wireframe";
import { useAutosave } from "./core/io/useAutosave";
import { initHistoryAutoTracking } from "./core/state/history";
import "./App.css";

// Modul-Registrierung: hier werden später auch weitere Modul-Familien
// (UML, Mindmap, ...) registriert. Läuft AUSSERHALB der Core-Engine (Kap. 4).
// Auf Modul-Ebene (nicht in useEffect), damit die Registry schon beim
// allerersten Render von Toolbox & Co. gefüllt ist.
registerBpmnModule();
registerWireframeModule();

// History-Erfassung startet ebenfalls auf Modul-Ebene, nicht in useEffect:
// so ist der Ausgangspunkt (currentSnapshot) bereits gesetzt, bevor
// irgendeine Komponente das erste Mal rendert oder der Store mutiert wird.
initHistoryAutoTracking();

function App() {
  useAutosave();

  const [showHelp, setShowHelp] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);

  // F1 öffnet/schließt die Hilfe global, unabhängig davon wo der Fokus liegt.
  // Alt+M schaltet das Theme um (siehe UI-DESIGNGUIDE.md Abschnitt 3/7).
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F1") {
        e.preventDefault();
        setShowHelp((prev) => !prev);
      }
      if (e.altKey && e.key.toLowerCase() === "m") {
        e.preventDefault();
        useThemeStore.getState().toggleTheme();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="app-layout">
      <Toolbar
        onShowHelp={() => setShowHelp(true)}
        onShowShortcuts={() => setShowShortcuts(true)}
        onShowLibrary={() => setShowLibrary(true)}
      />
      <RestorePrompt />
      <div className="app-body">
        <Toolbox />
        <main className="canvas-area">
          <CanvasEngine />
        </main>
        <PropertiesPanel />
      </div>
      {showHelp && <HelpOverlay onClose={() => setShowHelp(false)} />}
      {showShortcuts && <ShortcutOverlay onClose={() => setShowShortcuts(false)} />}
      {showLibrary && <LibraryPanel onClose={() => setShowLibrary(false)} />}
      <ToastStack />
    </div>
  );
}

export default App;
