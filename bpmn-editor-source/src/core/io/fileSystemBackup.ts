import { diagramToJson } from "./diagramSerializer";

/**
 * Optionale Ergänzung zur IndexedDB-Autosave: Der Nutzer kann einen echten
 * Ordner auf der Festplatte verknüpfen, in den zusätzlich gesichert wird.
 * Nutzt die File System Access API - nur in Chrome/Edge verfügbar (nicht
 * Firefox/Safari), daher immer mit Feature-Detection und als rein optionale
 * Ergänzung zur immer verfügbaren IndexedDB-Sicherung behandeln.
 *
 * Der Verzeichnis-Handle selbst überlebt einen Seiten-Reload NICHT von
 * allein (er ist nicht JSON-serialisierbar, daher kein localStorage
 * möglich) - er wird deshalb in einer eigenen, minimalen IndexedDB
 * abgelegt und beim App-Start über loadBackupDirHandle() wiederhergestellt
 * (siehe useAutosave.ts). Die Anzeigename-Kopie in localStorage erlaubt der
 * UI, den verbundenen Ordner sofort (synchron) anzuzeigen, statt beim Start
 * kurz "nicht verbunden" aufzublitzen, bis der asynchrone IndexedDB-Read
 * durch ist.
 */

// Minimale Typisierung der File System Access API, da TypeScript diese
// Browser-API noch nicht standardmäßig in den DOM-Typen führt.
export interface FileSystemDirectoryHandleLike {
  name: string;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandleLike>;
  requestPermission?(options: { mode: "read" | "readwrite" }): Promise<"granted" | "denied" | "prompt">;
  queryPermission?(options: { mode: "read" | "readwrite" }): Promise<"granted" | "denied" | "prompt">;
  /** Listet die Dateinamen im Ordner auf - nötig, um alte rollierende Backups zu erkennen/aufzuräumen. */
  keys(): AsyncIterableIterator<string>;
  removeEntry(name: string): Promise<void>;
}
interface FileSystemFileHandleLike {
  createWritable(): Promise<FileSystemWritableFileStreamLike>;
  getFile(): Promise<{ text(): Promise<string> }>;
}
interface FileSystemWritableFileStreamLike {
  write(data: string): Promise<void>;
  close(): Promise<void>;
}

declare global {
  interface Window {
    showDirectoryPicker?: (options?: { mode?: "read" | "readwrite" }) => Promise<FileSystemDirectoryHandleLike>;
  }
}

export function isFileSystemAccessSupported(): boolean {
  return typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";
}

const IDB_NAME = "bpmn-editor-handles";
const IDB_STORE = "handles";
const HANDLE_KEY = "backupDir";
const DIR_NAME_STORAGE_KEY = "bpmnEditorBackupDirName";

let directoryHandle: FileSystemDirectoryHandleLike | null = null;
let dbPromise: Promise<IDBDatabase> | null = null;

function openHandleDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(IDB_STORE)) {
        request.result.createObjectStore(IDB_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

async function idbGetHandle(): Promise<FileSystemDirectoryHandleLike | undefined> {
  const db = await openHandleDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    const req = tx.objectStore(IDB_STORE).get(HANDLE_KEY);
    req.onsuccess = () => resolve(req.result as FileSystemDirectoryHandleLike | undefined);
    req.onerror = () => reject(req.error);
  });
}

async function idbSetHandle(handle: FileSystemDirectoryHandleLike): Promise<void> {
  const db = await openHandleDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(handle, HANDLE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbDeleteHandle(): Promise<void> {
  const db = await openHandleDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).delete(HANDLE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Beim App-Start aufrufen: stellt einen zuvor verknüpften Ordner-Handle wieder her. */
export async function loadBackupDirHandle(): Promise<void> {
  if (!isFileSystemAccessSupported()) return;
  try {
    directoryHandle = (await idbGetHandle()) ?? null;
  } catch {
    directoryHandle = null;
  }
}

/** Synchron abfragbarer Anzeigename (siehe Kommentar oben) - unabhängig davon, ob loadBackupDirHandle() schon fertig ist. */
export function getConnectedDirectoryName(): string | null {
  return directoryHandle?.name ?? localStorage.getItem(DIR_NAME_STORAGE_KEY);
}

/** Der verknüpfte Ordner-Handle selbst - z.B. um ihn als `startIn` für den
 *  "Speichern"-Dateidialog zu übergeben (siehe SaveLoadButtons.tsx), damit
 *  dieser Ordner dort vorausgewählt geöffnet wird. `null`, solange kein
 *  Ordner verknüpft ist oder loadBackupDirHandle() noch nicht fertig ist. */
export function getBackupDirectoryHandle(): FileSystemDirectoryHandleLike | null {
  return directoryHandle;
}

/** Öffnet den nativen Ordner-Auswahl-Dialog und merkt den gewählten Ordner dauerhaft (übersteht Reloads). */
export async function connectBackupDirectory(): Promise<string | null> {
  if (!isFileSystemAccessSupported()) return null;
  try {
    const handle = await window.showDirectoryPicker!({ mode: "readwrite" });
    directoryHandle = handle;
    await idbSetHandle(handle);
    localStorage.setItem(DIR_NAME_STORAGE_KEY, handle.name);
    return handle.name;
  } catch {
    // Nutzer hat den Dialog abgebrochen - kein Fehlerfall, einfach nichts tun.
    return null;
  }
}

export async function disconnectBackupDirectory(): Promise<void> {
  directoryHandle = null;
  localStorage.removeItem(DIR_NAME_STORAGE_KEY);
  try {
    await idbDeleteHandle();
  } catch {
    // Handle-Eintrag konnte nicht gelöscht werden (z.B. IndexedDB gesperrt) -
    // die Verbindung ist trotzdem für die laufende Sitzung getrennt; beim
    // nächsten Start würde der alte Handle sonst erneut geladen, das ist
    // die einzige Konsequenz eines Fehlschlags hier.
  }
}

export type BackupDirPermission = "granted" | "prompt" | "denied" | "unavailable";

/** Nur zur Anzeige (z.B. "Berechtigung erneut bestätigen"-Hinweis) - fragt NICHT aktiv nach, siehe requestPermission unten. */
export async function getBackupDirPermissionStatus(): Promise<BackupDirPermission> {
  if (!directoryHandle?.queryPermission) return "unavailable";
  try {
    return await directoryHandle.queryPermission({ mode: "readwrite" });
  } catch {
    return "unavailable";
  }
}

// queryPermission liefert 'granted'/'denied'/'prompt'. requestPermission
// braucht eine User-Geste - deshalb darf ensureBackupDirPermission() nur
// aus Click-Handlern heraus aufgerufen werden (z.B. dem "Berechtigung
// bestätigen"-Button in AutosaveMenu.tsx), nicht aus Hintergrund-Timern.
// Nach einem Browser-Neustart ist die Berechtigung eines wiederhergestellten
// Handles typischerweise wieder auf "prompt" zurückgefallen, auch wenn sie
// vorher erteilt war - das ist Browser-Verhalten, keine Lücke hier.
export async function ensureBackupDirPermission(): Promise<boolean> {
  if (!directoryHandle) return false;
  const opts = { mode: "readwrite" as const };
  try {
    const status = directoryHandle.queryPermission ? await directoryHandle.queryPermission(opts) : "granted";
    if (status === "granted") return true;
    if (!directoryHandle.requestPermission) return false;
    return (await directoryHandle.requestPermission(opts)) === "granted";
  } catch {
    return false;
  }
}

const DIR_BACKUP_PREFIX = "backup_";
const DIR_BACKUP_SUFFIX = ".json";

/**
 * Schreibt eine neue zeitgestempelte Backup-Datei in den verknüpften Ordner
 * und entfernt danach die ältesten, falls mehr als `maxCount` vorhanden sind
 * (fortlaufende Rotation, siehe Anwendung in useAutosave.ts). Der
 * Zeitstempel im ISO-Format ist lexikografisch sortierbar, daher genügt ein
 * einfacher String-Sort zur Alter-Bestimmung - keine separate Metadaten-
 * Ablage nötig.
 */
export async function writeRotatingBackupToDirectory(
  maxCount: number
): Promise<{ success: true } | { success: false; error: string }> {
  if (!directoryHandle) {
    return { success: false, error: "Kein Ordner verknüpft." };
  }
  if (!(await ensureBackupDirPermission())) {
    return { success: false, error: "Keine Berechtigung für den verknüpften Ordner." };
  }
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileHandle = await directoryHandle.getFileHandle(`${DIR_BACKUP_PREFIX}${stamp}${DIR_BACKUP_SUFFIX}`, {
      create: true,
    });
    const writable = await fileHandle.createWritable();
    await writable.write(diagramToJson());
    await writable.close();
    await pruneDirectoryBackups(maxCount);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unbekannter Fehler beim Schreiben." };
  }
}

export interface LibraryEntry {
  /** Dateiname inkl. `.json`, dient als eindeutiger Schlüssel zum erneuten Öffnen. */
  name: string;
  title: string;
  keywords: string[];
  shapeCount: number;
  createdAt: string | null;
}

/**
 * Listet alle Diagramm-Dateien im verknüpften Ordner auf (Bibliothek, siehe
 * ui/Library/LibraryPanel.tsx). Schließt die rollierenden Auto-Backups
 * (`backup_*.json`, siehe writeRotatingBackupToDirectory) bewusst aus - das
 * sind keine bewusst benannten Speicherungen des Nutzers, sondern reine
 * Sicherheitskopien. Liest jede Datei einzeln neu ein (kein separater,
 * browserseitig gecachter Index) - damit die Liste IMMER exakt widerspiegelt,
 * was tatsächlich im Ordner liegt, und Titel/Stichwörter auch nach einem
 * gelöschten Browser-Speicher vollständig erhalten bleiben (siehe
 * BPMN-Editor-Technische-Dokumentation.md Abschnitt 4.9).
 */
export async function listLibraryEntries(): Promise<
  { success: true; entries: LibraryEntry[] } | { success: false; error: string }
> {
  if (!directoryHandle) {
    return { success: false, error: "Kein Ordner verknüpft." };
  }
  if (!(await ensureBackupDirPermission())) {
    return { success: false, error: "Keine Berechtigung für den verknüpften Ordner." };
  }
  const handle = directoryHandle;
  try {
    const names: string[] = [];
    for await (const name of handle.keys()) {
      if (name.endsWith(".json") && !name.startsWith(DIR_BACKUP_PREFIX)) names.push(name);
    }
    const entries = await Promise.all(
      names.map(async (name): Promise<LibraryEntry | null> => {
        try {
          const fileHandle = await handle.getFileHandle(name);
          const file = await fileHandle.getFile();
          const text = await file.text();
          const parsed = JSON.parse(text) as {
            shapes?: unknown[];
            createdAt?: string;
            meta?: { title?: string; keywords?: string[] };
          };
          if (!Array.isArray(parsed.shapes)) return null; // keine Diagramm-Datei - überspringen
          return {
            name,
            title: typeof parsed.meta?.title === "string" ? parsed.meta.title : "",
            keywords: Array.isArray(parsed.meta?.keywords)
              ? parsed.meta!.keywords!.filter((k): k is string => typeof k === "string")
              : [],
            shapeCount: parsed.shapes.length,
            createdAt: typeof parsed.createdAt === "string" ? parsed.createdAt : null,
          };
        } catch {
          // Datei nicht lesbar oder kein gültiges JSON - einzeln überspringen,
          // statt die gesamte Bibliotheksliste scheitern zu lassen.
          return null;
        }
      })
    );
    return { success: true, entries: entries.filter((e): e is LibraryEntry => e !== null) };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unbekannter Fehler beim Lesen des Ordners." };
  }
}

/** Liest den Inhalt einer einzelnen Bibliotheks-Datei zum Laden (siehe LibraryPanel.tsx). */
export async function readLibraryEntryContent(
  name: string
): Promise<{ success: true; content: string } | { success: false; error: string }> {
  if (!directoryHandle) {
    return { success: false, error: "Kein Ordner verknüpft." };
  }
  try {
    const fileHandle = await directoryHandle.getFileHandle(name);
    const file = await fileHandle.getFile();
    return { success: true, content: await file.text() };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Datei konnte nicht gelesen werden." };
  }
}

/** Entfernt die ältesten rollierenden Backup-Dateien, sobald mehr als `maxCount` vorhanden sind. */
async function pruneDirectoryBackups(maxCount: number): Promise<void> {
  if (!directoryHandle) return;
  const names: string[] = [];
  for await (const name of directoryHandle.keys()) {
    if (name.startsWith(DIR_BACKUP_PREFIX) && name.endsWith(DIR_BACKUP_SUFFIX)) names.push(name);
  }
  names.sort();
  const excess = names.length - maxCount;
  if (excess <= 0) return;
  for (const name of names.slice(0, excess)) {
    try {
      await directoryHandle.removeEntry(name);
    } catch {
      // Einzelne Datei ließ sich nicht löschen (z.B. gerade extern geöffnet) -
      // kein kritischer Fehler, der nächste Rotationslauf versucht es erneut.
    }
  }
}
