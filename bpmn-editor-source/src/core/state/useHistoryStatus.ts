import { useEffect, useState } from "react";
import { canUndo, canRedo, subscribeToHistory } from "./history";

/** Reaktiver Zugriff auf den Undo/Redo-Status für UI-Komponenten (z.B. Toolbar-Buttons). */
export function useHistoryStatus() {
  const [state, setState] = useState({ canUndo: canUndo(), canRedo: canRedo() });

  useEffect(() => {
    const update = () => setState({ canUndo: canUndo(), canRedo: canRedo() });
    update();
    return subscribeToHistory(update);
  }, []);

  return state;
}
