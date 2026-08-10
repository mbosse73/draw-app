import { diagramToJson, loadDiagramFromJson } from "../../core/io/diagramSerializer";
import { downloadTextFile, pickAndReadTextFile } from "../../core/io/fileIo";
import { useCanvasStore } from "../../core/state/canvasStore";
import { clearHistory, pushHistorySnapshot } from "../../core/state/history";
import { writeBackup } from "../../core/io/autosave";
import { useFavoritesStore } from "../Toolbox/favoritesStore";

function timestampedName(base: string, ext: string): string {
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  return `${base}_${stamp}.${ext}`;
}

export function SaveLoadButtons() {
  const handleSave = () => {
    const favoriteTypes = useFavoritesStore.getState().favoriteTypes;
    downloadTextFile(diagramToJson(favoriteTypes), timestampedName("diagramm", "json"), "application/json");
  };

  const handleLoad = async () => {
    const hasContent = Object.keys(useCanvasStore.getState().shapes).length > 0;
    if (hasContent) {
      const confirmed = window.confirm(
        "Der aktuelle Arbeitsstand wird beim Laden überschrieben. Fortfahren?"
      );
      if (!confirmed) return;
      // Vor dem Überschreiben sicherheitshalber noch ein Backup des aktuellen
      // Stands anlegen, falls der Nutzer es sich anders überlegt.
      await writeBackup();
    }
    const content = await pickAndReadTextFile(".json,application/json");
    if (content === null) return;
    const result = loadDiagramFromJson(content);
    if (!result.success) {
      alert("Datei konnte nicht geladen werden: " + result.error);
      return;
    }
    // Im Diagramm mitgespeicherte Favoriten additiv übernehmen - bestehende
    // eigene Favoriten bleiben erhalten, statt überschrieben zu werden.
    if (result.favorites && result.favorites.length > 0) {
      useFavoritesStore.getState().mergeFavorites(result.favorites);
    }
    // Undo-Historie gehört zum jeweiligen Diagramm - nach dem Laden einer
    // anderen Datei wäre ein Undo zurück ins vorherige Diagramm verwirrend.
    clearHistory();
    pushHistorySnapshot();
  };

  return (
    <>
      <button onClick={handleLoad} title="Diagramm aus einer Datei laden">
        Öffnen…
      </button>
      <button onClick={handleSave} title="Diagramm als Datei speichern">
        Speichern
      </button>
    </>
  );
}
