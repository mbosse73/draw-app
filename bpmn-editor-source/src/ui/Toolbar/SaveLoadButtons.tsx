import { diagramToJson, loadDiagramFromJson } from "../../core/io/diagramSerializer";
import { downloadTextFile, pickAndReadTextFile } from "../../core/io/fileIo";
import { useCanvasStore } from "../../core/state/canvasStore";
import { clearHistory, pushHistorySnapshot } from "../../core/state/history";
import { writeBackup } from "../../core/io/autosave";
import { getBackupDirectoryHandle, type FileSystemDirectoryHandleLike } from "../../core/io/fileSystemBackup";
import { useFavoritesStore } from "../Toolbox/favoritesStore";
import { showToast } from "../Toast/toastStore";
import { importDrawioXml } from "../../modules/bpmn/io/drawioImport";

function timestampedName(base: string, ext: string): string {
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  return `${base}_${stamp}.${ext}`;
}

// "Speichern unter"-Dialog des Betriebssystems, wenn verfügbar (siehe
// BACKUP-SYSTEM-ANWEISUNG.md Abschnitt 5) - erlaubt dem Nutzer, Ordner +
// Dateiname frei zu wählen, statt immer in den Standard-Downloads-Ordner zu
// speichern. Nur Chromium; überall sonst Fallback auf den klassischen
// Blob-Download.
declare global {
  interface Window {
    showSaveFilePicker?: (options?: {
      suggestedName?: string;
      types?: { description: string; accept: Record<string, string[]> }[];
      // Ein FileSystemDirectoryHandle (oder ein bekannter Ordnername wie
      // "desktop"/"documents") lässt den Dialog dort vorausgewählt öffnen -
      // hier genutzt, um den verknüpften Ordner (fileSystemBackup.ts) als
      // Standardordner für "Speichern" zu übergeben.
      startIn?: FileSystemDirectoryHandleLike | string;
    }) => Promise<{
      createWritable: () => Promise<{ write(data: string): Promise<void>; close(): Promise<void> }>;
      name: string;
    }>;
  }
}

/** Speichern/Öffnen/draw.io-Import-Logik, unabhängig von einer konkreten
 *  Button-Darstellung - wird sowohl von den Textzeilen im Datei-Menü als auch
 *  von den Icon-Buttons in der Schnellzugriffsleiste verwendet (siehe
 *  MenuBar.tsx / QuickAccessBar.tsx). */
export function useSaveLoadActions() {
  const handleSave = async () => {
    const favoriteTypes = useFavoritesStore.getState().favoriteTypes;
    const json = diagramToJson(favoriteTypes);

    if (typeof window.showSaveFilePicker === "function") {
      try {
        // Verknüpften Ordner (fileSystemBackup.ts) als Startordner nutzen,
        // falls vorhanden - der Speichern-Dialog öffnet sich dann direkt dort,
        // der Nutzer bestätigt Dateiname/Ort aber weiterhin selbst (siehe
        // BPMN-Editor-Technische-Dokumentation.md Abschnitt 4.6).
        const directoryHandle = getBackupDirectoryHandle();
        const fileHandle = await window.showSaveFilePicker({
          suggestedName: timestampedName("diagramm", "json"),
          types: [{ description: "JSON-Datei", accept: { "application/json": [".json"] } }],
          ...(directoryHandle ? { startIn: directoryHandle } : {}),
        });
        const writable = await fileHandle.createWritable();
        await writable.write(json);
        await writable.close();
        showToast(`Diagramm gespeichert: ${fileHandle.name}`, "success");
        return;
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return; // Nutzer hat abgebrochen
        // sonst: Fallback unten (z.B. API vorhanden, aber aus anderem Grund fehlgeschlagen)
      }
    }

    downloadTextFile(json, timestampedName("diagramm", "json"), "application/json");
    showToast("Diagramm heruntergeladen", "success");
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
      showToast("Datei konnte nicht geladen werden: " + result.error, "error");
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
    showToast("Diagramm geladen", "success");
  };

  const handleLoadDrawio = async () => {
    const hasContent = Object.keys(useCanvasStore.getState().shapes).length > 0;
    if (hasContent) {
      const confirmed = window.confirm(
        "Der aktuelle Arbeitsstand wird beim Importieren überschrieben. Fortfahren?"
      );
      if (!confirmed) return;
      await writeBackup();
    }
    const content = await pickAndReadTextFile(".drawio,.xml,application/xml");
    if (content === null) return;
    const result = importDrawioXml(content);
    if (!result.success) {
      showToast("draw.io-Datei konnte nicht importiert werden: " + result.error, "error");
      return;
    }
    // draw.io-Dateien kennen keinen Titel/Stichwörter (fremdes Format) - Meta
    // der zuvor offenen Zeichnung wird zurückgesetzt, damit sie nicht
    // fälschlich am neu importierten Diagramm "kleben" bleibt.
    useCanvasStore.getState().setDiagramTitle("");
    useCanvasStore.getState().setDiagramKeywords([]);
    clearHistory();
    pushHistorySnapshot();
    showToast("draw.io-Datei importiert", "success");
  };

  return { handleSave, handleLoad, handleLoadDrawio };
}
