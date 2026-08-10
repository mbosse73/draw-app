import { useEffect, useState } from "react";
import { hasAutosave, restoreAutosave, readAutosave, clearAutosave } from "../../core/io/autosave";
import { useCanvasStore } from "../../core/state/canvasStore";

/**
 * Zeigt beim App-Start einmalig einen Hinweis, falls ein automatisch
 * gesicherter Arbeitsstand aus einer vorherigen Sitzung existiert. Der Nutzer
 * entscheidet aktiv, ob er ihn übernehmen möchte - kein automatisches,
 * überraschendes Überschreiben eines leeren, frisch geöffneten Diagramms.
 */
export function RestorePrompt() {
  const [status, setStatus] = useState<"checking" | "offer" | "hidden">("checking");
  const [shapeCount, setShapeCount] = useState(0);

  useEffect(() => {
    (async () => {
      const available = await hasAutosave();
      if (!available) {
        setStatus("hidden");
        return;
      }
      const diagram = await readAutosave();
      setShapeCount(diagram?.shapes.length ?? 0);
      setStatus("offer");
    })();
  }, []);

  if (status !== "offer") return null;

  const handleRestore = async () => {
    // Sicherheitsabfrage: falls der Nutzer in der kurzen Zeit zwischen
    // App-Start und dem Laden dieses Banners bereits selbst etwas gezeichnet
    // hat, würde ein Wiederherstellen diese frische Arbeit stillschweigend
    // überschreiben - das bestätigen wir lieber explizit statt es zu riskieren.
    const currentShapeCount = Object.keys(useCanvasStore.getState().shapes).length;
    if (currentShapeCount > 0) {
      const confirmed = window.confirm(
        "Du hast bereits Elemente auf der Fläche. Diese werden durch den automatisch gesicherten Stand ersetzt. Fortfahren?"
      );
      if (!confirmed) return;
    }
    await restoreAutosave();
    setStatus("hidden");
  };

  const handleDismiss = async () => {
    // Bewusst nicht automatisch löschen - der Nutzer könnte später doch
    // noch darauf zugreifen wollen. Nur das Banner wird ausgeblendet.
    setStatus("hidden");
  };

  const handleDiscard = async () => {
    await clearAutosave();
    setStatus("hidden");
  };

  return (
    <div className="restore-banner">
      <span>
        Es wurde ein automatisch gesicherter Arbeitsstand gefunden ({shapeCount} Element{shapeCount === 1 ? "" : "e"}).
        Möchtest du ihn wiederherstellen?
      </span>
      <div className="restore-banner-actions">
        <button onClick={handleRestore}>Wiederherstellen</button>
        <button onClick={handleDismiss}>Später</button>
        <button onClick={handleDiscard} className="restore-banner-discard">
          Verwerfen
        </button>
      </div>
    </div>
  );
}
