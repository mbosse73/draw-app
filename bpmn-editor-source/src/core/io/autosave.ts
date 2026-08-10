import { useCanvasStore } from "../state/canvasStore";
import { serializeDiagram, type DiagramFile } from "../io/diagramSerializer";

/**
 * Automatische Sicherung des Arbeitsstands in IndexedDB (läuft in jedem
 * modernen Browser, kein Dateisystem-Zugriff nötig). Das ist die zuverlässige
 * Basis-Absicherung gegen Datenverlust bei versehentlichem Tab-Schließen oder
 * Absturz - unabhängig davon, ob der Nutzer zusätzlich einen echten Ordner
 * verknüpft hat (siehe fileSystemBackup.ts für die optionale Ergänzung).
 */

const DB_NAME = "bpmn-editor-autosave";
const DB_VERSION = 1;
const STORE_NAME = "snapshots";
// Fester, dokumentierter "Pfad" innerhalb des Object Stores - technisch ist das
// kein Datei-Pfad, sondern ein Schlüssel in der Browser-eigenen Datenbank.
const AUTOSAVE_KEY = "autosave/current";
const BACKUP_KEY_PREFIX = "backup/";
const MAX_BACKUPS = 10;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

async function idbPut(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

async function idbGetAllKeys(): Promise<string[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).getAllKeys();
    req.onsuccess = () => resolve(req.result as string[]);
    req.onerror = () => reject(req.error);
  });
}

async function idbDelete(key: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Speichert den aktuellen Arbeitsstand als Auto-Save (überschreibt den vorherigen). */
export async function writeAutosave(): Promise<void> {
  const diagram = serializeDiagram();
  // Leere Diagramme nicht sichern - sonst würde ein Neuladen der leeren App
  // sofort den letzten Autosave überschreiben, bevor der Nutzer geladen hat.
  if (diagram.shapes.length === 0) return;
  await idbPut(AUTOSAVE_KEY, diagram);
}

export async function readAutosave(): Promise<DiagramFile | undefined> {
  return idbGet<DiagramFile>(AUTOSAVE_KEY);
}

export async function hasAutosave(): Promise<boolean> {
  const data = await readAutosave();
  return Boolean(data && data.shapes.length > 0);
}

/**
 * Legt zusätzlich eine zeitgestempelte Backup-Kopie an (z.B. periodisch alle
 * paar Minuten oder vor risikoreichen Aktionen wie "Laden"). Älteste Backups
 * werden automatisch entfernt, sobald MAX_BACKUPS überschritten wird.
 */
export async function writeBackup(): Promise<void> {
  const diagram = serializeDiagram();
  if (diagram.shapes.length === 0) return;

  const allKeys = await idbGetAllKeys();
  const backupKeys = allKeys.filter((k) => k.startsWith(BACKUP_KEY_PREFIX)).sort();

  // Dedup: kein neues Backup, wenn sich seit dem letzten nichts geändert hat
  // (siehe BACKUP-SYSTEM-ANWEISUNG.md Abschnitt 4) - verhindert 10 identische
  // Snapshots, nur weil der Nutzer über einen längeren Zeitraum am selben
  // Diagramm ohne Änderungen gearbeitet hat (z.B. nur gescrollt/gezoomt).
  // WICHTIG: nur shapes/connectors vergleichen, nicht das ganze DiagramFile -
  // `createdAt` ist bei jedem Aufruf ein neuer Zeitstempel und würde den
  // Vergleich sonst immer scheitern lassen.
  const newestKey = backupKeys[backupKeys.length - 1];
  if (newestKey) {
    const newest = await idbGet<DiagramFile>(newestKey);
    if (
      newest &&
      JSON.stringify(newest.shapes) === JSON.stringify(diagram.shapes) &&
      JSON.stringify(newest.connectors) === JSON.stringify(diagram.connectors)
    ) {
      return;
    }
  }

  const key = `${BACKUP_KEY_PREFIX}${Date.now()}`;
  await idbPut(key, diagram);

  const excess = backupKeys.length + 1 - MAX_BACKUPS;
  if (excess > 0) {
    for (const oldKey of backupKeys.slice(0, excess)) {
      await idbDelete(oldKey);
    }
  }
}

export interface BackupEntry {
  key: string;
  timestamp: number;
  shapeCount: number;
}

export async function listBackups(): Promise<BackupEntry[]> {
  const allKeys = await idbGetAllKeys();
  const backupKeys = allKeys.filter((k) => k.startsWith(BACKUP_KEY_PREFIX)).sort().reverse();
  const entries: BackupEntry[] = [];
  for (const key of backupKeys) {
    const diagram = await idbGet<DiagramFile>(key);
    if (diagram) {
      entries.push({
        key,
        timestamp: Number(key.slice(BACKUP_KEY_PREFIX.length)),
        shapeCount: diagram.shapes.length,
      });
    }
  }
  return entries;
}

export async function restoreBackup(key: string): Promise<boolean> {
  const diagram = await idbGet<DiagramFile>(key);
  if (!diagram) return false;
  applyDiagram(diagram);
  return true;
}

export async function restoreAutosave(): Promise<boolean> {
  const diagram = await readAutosave();
  if (!diagram) return false;
  applyDiagram(diagram);
  return true;
}

function applyDiagram(diagram: DiagramFile): void {
  const shapesRecord: Record<string, (typeof diagram.shapes)[number]> = {};
  diagram.shapes.forEach((s) => (shapesRecord[s.id] = s));
  const connectorsRecord: Record<string, (typeof diagram.connectors)[number]> = {};
  diagram.connectors.forEach((c) => (connectorsRecord[c.id] = c));
  useCanvasStore.setState({
    shapes: shapesRecord,
    connectors: connectorsRecord,
    selectedShapeIds: [],
    selectedConnectorId: null,
  });
}

export async function clearAutosave(): Promise<void> {
  await idbDelete(AUTOSAVE_KEY);
}
