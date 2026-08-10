import { diagramToJson } from "./diagramSerializer";

/**
 * Optionale Ergänzung zur IndexedDB-Autosave: Der Nutzer kann einen echten
 * Ordner auf der Festplatte verknüpfen, in den zusätzlich gesichert wird.
 * Nutzt die File System Access API - nur in Chrome/Edge verfügbar (nicht
 * Firefox/Safari), daher immer mit Feature-Detection und als rein optionale
 * Ergänzung zur immer verfügbaren IndexedDB-Sicherung behandeln.
 */

// Minimale Typisierung der File System Access API, da TypeScript diese
// Browser-API noch nicht standardmäßig in den DOM-Typen führt.
interface FileSystemDirectoryHandleLike {
  name: string;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandleLike>;
  requestPermission?(options: { mode: "read" | "readwrite" }): Promise<"granted" | "denied" | "prompt">;
  queryPermission?(options: { mode: "read" | "readwrite" }): Promise<"granted" | "denied" | "prompt">;
}
interface FileSystemFileHandleLike {
  createWritable(): Promise<FileSystemWritableFileStreamLike>;
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

let directoryHandle: FileSystemDirectoryHandleLike | null = null;

export function getConnectedDirectoryName(): string | null {
  return directoryHandle?.name ?? null;
}

/** Öffnet den nativen Ordner-Auswahl-Dialog und merkt sich den gewählten Ordner für diese Sitzung. */
export async function connectBackupDirectory(): Promise<string | null> {
  if (!isFileSystemAccessSupported()) return null;
  try {
    const handle = await window.showDirectoryPicker!({ mode: "readwrite" });
    directoryHandle = handle;
    return handle.name;
  } catch {
    // Nutzer hat den Dialog abgebrochen - kein Fehlerfall, einfach nichts tun.
    return null;
  }
}

export function disconnectBackupDirectory(): void {
  directoryHandle = null;
}

/** Schreibt den aktuellen Arbeitsstand als JSON-Datei in den verknüpften Ordner. */
export async function writeToBackupDirectory(): Promise<{ success: true } | { success: false; error: string }> {
  if (!directoryHandle) {
    return { success: false, error: "Kein Ordner verknüpft." };
  }
  try {
    const fileHandle = await directoryHandle.getFileHandle("bpmn-editor-autosave.json", { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(diagramToJson());
    await writable.close();
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unbekannter Fehler beim Schreiben." };
  }
}

/** Schreibt zusätzlich eine zeitgestempelte Backup-Datei (nicht die laufend überschriebene Autosave-Datei). */
export async function writeTimestampedBackupToDirectory(): Promise<{ success: true } | { success: false; error: string }> {
  if (!directoryHandle) {
    return { success: false, error: "Kein Ordner verknüpft." };
  }
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileHandle = await directoryHandle.getFileHandle(`backup_${stamp}.json`, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(diagramToJson());
    await writable.close();
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unbekannter Fehler beim Schreiben." };
  }
}
