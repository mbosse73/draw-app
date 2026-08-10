import { useEffect, useState } from "react";
import { useModalDialog } from "../useModalDialog";
import { useCanvasStore } from "../../core/state/canvasStore";
import { loadDiagramFromJson } from "../../core/io/diagramSerializer";
import { clearHistory, pushHistorySnapshot } from "../../core/state/history";
import { useFavoritesStore } from "../Toolbox/favoritesStore";
import { showToast } from "../Toast/toastStore";
import {
  isFileSystemAccessSupported,
  connectBackupDirectory,
  getConnectedDirectoryName,
  listLibraryEntries,
  readLibraryEntryContent,
  type LibraryEntry,
} from "../../core/io/fileSystemBackup";

function formatDate(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

/** Wandelt das rohe Stichwort-Eingabefeld (kommagetrennter Text) in ein
 *  bereinigtes Array um - siehe Kommentar bei KeywordsField unten dazu,
 *  warum das erst beim Verlassen des Felds passiert statt bei jedem Tastendruck. */
function parseKeywords(raw: string): string[] {
  return raw
    .split(",")
    .map((k) => k.trim())
    .filter((k) => k.length > 0);
}

function matchesQuery(entry: LibraryEntry, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  if (entry.name.toLowerCase().includes(q)) return true;
  if (entry.title.toLowerCase().includes(q)) return true;
  return entry.keywords.some((k) => k.toLowerCase().includes(q));
}

/**
 * Durchsuchbare Bibliothek aller im verknüpften Ordner gespeicherten
 * Zeichnungen (Dateiname + Titel/Stichwörter), plus Eingabefelder für Titel/
 * Stichwörter der aktuell offenen Zeichnung. Bewusst OHNE eigenen,
 * browserseitigen Index - jedes Öffnen liest den Ordner frisch ein (siehe
 * fileSystemBackup.ts `listLibraryEntries` für die Begründung).
 */
export function LibraryPanel({ onClose }: { onClose: () => void }) {
  const dialogRef = useModalDialog(onClose);
  const diagramMeta = useCanvasStore((s) => s.diagramMeta);
  const setDiagramTitle = useCanvasStore((s) => s.setDiagramTitle);
  const setDiagramKeywords = useCanvasStore((s) => s.setDiagramKeywords);

  const [titleInput, setTitleInput] = useState(diagramMeta.title);
  const [keywordsInput, setKeywordsInput] = useState(diagramMeta.keywords.join(", "));

  const [directoryName, setDirectoryName] = useState<string | null>(getConnectedDirectoryName());
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const supported = isFileSystemAccessSupported();

  const refresh = async () => {
    if (!directoryName) return;
    setLoading(true);
    setLoadError(null);
    const result = await listLibraryEntries();
    setLoading(false);
    if (result.success) {
      // Neueste zuerst - createdAt fehlt bei sehr alten Dateien evtl., dann ans Ende.
      setEntries([...result.entries].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "")));
    } else {
      setLoadError(result.error);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [directoryName]);

  const handleConnect = async () => {
    const name = await connectBackupDirectory();
    if (name) setDirectoryName(name);
  };

  const commitTitle = () => setDiagramTitle(titleInput);
  const commitKeywords = () => setDiagramKeywords(parseKeywords(keywordsInput));

  const handleOpenEntry = async (entry: LibraryEntry) => {
    const hasContent = Object.keys(useCanvasStore.getState().shapes).length > 0;
    if (hasContent) {
      const confirmed = window.confirm(`Der aktuelle Arbeitsstand wird durch "${entry.name}" ersetzt. Fortfahren?`);
      if (!confirmed) return;
    }
    const read = await readLibraryEntryContent(entry.name);
    if (!read.success) {
      showToast("Datei konnte nicht gelesen werden: " + read.error, "error");
      return;
    }
    const result = loadDiagramFromJson(read.content);
    if (!result.success) {
      showToast("Datei konnte nicht geladen werden: " + result.error, "error");
      return;
    }
    if (result.favorites && result.favorites.length > 0) {
      useFavoritesStore.getState().mergeFavorites(result.favorites);
    }
    clearHistory();
    pushHistorySnapshot();
    showToast(`Zeichnung geladen: ${entry.name}`, "success");
    dialogRef.current?.close();
  };

  const filtered = entries.filter((e) => matchesQuery(e, query));

  return (
    <dialog ref={dialogRef} className="modal-panel modal-panel--wide">
      <div className="modal-header">
        <h3>Bibliothek</h3>
        <button className="modal-close" onClick={() => dialogRef.current?.close()} title="Schließen">
          ×
        </button>
      </div>

      <div className="modal-body library-body">
        <div className="library-current">
          <h4>Aktuelle Zeichnung</h4>
          <label className="properties-field">
            <span>Titel</span>
            <input
              type="text"
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              onBlur={commitTitle}
              placeholder="z.B. Bestellprozess V2"
            />
          </label>
          <label className="properties-field">
            <span>Stichwörter (kommagetrennt)</span>
            <input
              type="text"
              value={keywordsInput}
              onChange={(e) => setKeywordsInput(e.target.value)}
              onBlur={commitKeywords}
              placeholder="z.B. Einkauf, Freigabe, Entwurf"
            />
          </label>
          <p className="library-hint">
            Titel/Stichwörter werden beim nächsten "Speichern" in die Datei geschrieben und stehen danach in der
            Bibliothek zur Suche zur Verfügung.
          </p>
        </div>

        <div className="toolbar-menu-divider" />

        <div className="library-browse">
          <h4>Gespeicherte Zeichnungen durchsuchen</h4>
          {!supported && (
            <p className="autosave-info">
              Die Bibliothek benötigt einen verknüpften Ordner (File System Access API) und funktioniert nur in
              Chrome/Edge.
            </p>
          )}
          {supported && !directoryName && (
            <>
              <p className="autosave-info">
                Noch kein Ordner verknüpft. Die Bibliothek durchsucht denselben Ordner, der auch für "Speichern" und
                Auto-Backups genutzt wird.
              </p>
              <button onClick={handleConnect}>Ordner verknüpfen…</button>
            </>
          )}
          {supported && directoryName && (
            <>
              <div className="library-search-row">
                <input
                  type="text"
                  className="library-search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Suche nach Dateiname, Titel oder Stichwort…"
                  autoFocus
                />
                <button onClick={refresh} title="Liste neu einlesen">
                  ⟳
                </button>
              </div>
              {loading && <p className="autosave-info">Lädt…</p>}
              {loadError && <p className="autosave-info autosave-info--warn">{loadError}</p>}
              {!loading && !loadError && filtered.length === 0 && (
                <p className="library-empty">
                  {entries.length === 0 ? "Noch keine gespeicherten Zeichnungen in diesem Ordner." : "Keine Treffer."}
                </p>
              )}
              <ul className="library-list">
                {filtered.map((entry) => (
                  <li key={entry.name} className="library-entry" onClick={() => handleOpenEntry(entry)}>
                    <div className="library-entry-main">
                      <span className="library-entry-title">{entry.title || entry.name}</span>
                      <span className="library-entry-date">{formatDate(entry.createdAt)}</span>
                    </div>
                    <div className="library-entry-sub">
                      {entry.name} · {entry.shapeCount} Elemente
                    </div>
                    {entry.keywords.length > 0 && (
                      <div className="library-entry-tags">
                        {entry.keywords.map((k) => (
                          <span key={k} className="library-tag">
                            {k}
                          </span>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </dialog>
  );
}
