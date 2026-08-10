import { useCanvasStore } from "../../core/state/canvasStore";
import { computeAutoLayout } from "../../core/canvas/autoLayout";
import { pushHistorySnapshot } from "../../core/state/history";

/**
 * Ordnet alle Top-Level-Elemente (keine Lane-/Pool-Inhalte) automatisch in
 * einem sauberen Schichten-Layout an. Pool/Lane-Inhalte bleiben unangetastet,
 * da ihre Position strukturell an die Container-Zuordnung gebunden ist.
 */
export function AutoLayoutButton() {
  const handleClick = () => {
    const state = useCanvasStore.getState();
    const shapeCount = Object.keys(state.shapes).length;
    if (shapeCount === 0) return;

    const confirmed = window.confirm(
      "Alle frei platzierten Elemente werden automatisch neu angeordnet (Elemente innerhalb von Pools/Lanes bleiben unverändert). Fortfahren?"
    );
    if (!confirmed) return;

    const { positions } = computeAutoLayout(state.shapes, state.connectors);
    for (const [id, position] of Object.entries(positions)) {
      // moveShape nutzen (nicht direkt updateShape), damit z.B. Snap-Verhalten
      // konsistent bleibt - hier mit skipGridSnap=true, da die berechneten
      // Layout-Koordinaten bereits sinnvoll sind und nicht zusätzlich aufs
      // Anzeige-Grid gerundet werden sollen.
      useCanvasStore.getState().moveShape(id, position, true);
    }
    pushHistorySnapshot();
  };

  return (
    <button onClick={handleClick} title="Elemente automatisch anordnen (Schichten-Layout)">
      ⊞ Auto-Layout
    </button>
  );
}
