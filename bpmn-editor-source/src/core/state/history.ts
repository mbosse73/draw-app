import { useCanvasStore } from "./canvasStore";
import type { ShapeInstance, ConnectorInstance } from "../shapes/types";

/**
 * Undo/Redo als eigenständiger Snapshot-Stack, bewusst getrennt vom
 * Zustand-Store selbst. History erfasst nur das fachlich Relevante: shapes +
 * connectors. Viewport, Selektion, Hover- und Drag-Zwischenzustände werden
 * bewusst NICHT mitgesichert, damit ein Undo nicht die Kameraposition
 * verändert oder mitten in einer Aktion "hängen bleibt".
 *
 * WICHTIG: Snapshots werden NICHT mehr manuell aus der UI-Schicht heraus
 * ausgelöst (das war fehleranfällig - leicht zu vergessen, und abhängig von
 * korrekter Verkabelung an vielen Stellen). Stattdessen abonniert
 * initHistoryAutoTracking() den Store direkt und legt bei jeder inhaltlichen
 * Änderung an shapes/connectors automatisch (debounced) einen Snapshot an.
 * Das macht die History-Erfassung unabhängig davon, WIE eine Änderung
 * zustande kam.
 */
interface Snapshot {
  shapes: Record<string, ShapeInstance>;
  connectors: Record<string, ConnectorInstance>;
}

const MAX_HISTORY = 100;
const DEBOUNCE_MS = 400;

let undoStack: Snapshot[] = [];
let redoStack: Snapshot[] = [];
let currentSnapshot: Snapshot | null = null;
// Verhindert, dass das Zurückspielen eines Snapshots selbst wieder als neue
// Änderung erfasst wird.
let isRestoring = false;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let trackingInitialized = false;

function cloneSnapshot(): Snapshot {
  const state = useCanvasStore.getState();
  return {
    shapes: structuredClone(state.shapes),
    connectors: structuredClone(state.connectors),
  };
}

function shapesEqual(a: Snapshot, b: Snapshot): boolean {
  // Günstiger struktureller Vergleich über JSON - shapes/connectors sind
  // reine Daten (keine Funktionen/Dates), das ist hier ausreichend und
  // deutlich einfacher als ein manuelles Deep-Equal.
  return JSON.stringify(a.shapes) === JSON.stringify(b.shapes) && JSON.stringify(a.connectors) === JSON.stringify(b.connectors);
}

function applySnapshot(snapshot: Snapshot): void {
  isRestoring = true;
  useCanvasStore.setState({
    shapes: snapshot.shapes,
    connectors: snapshot.connectors,
    selectedShapeIds: [],
    selectedConnectorId: null,
  });
  isRestoring = false;
}

function commitSnapshot(): void {
  const fresh = cloneSnapshot();
  if (currentSnapshot !== null && shapesEqual(currentSnapshot, fresh)) {
    return;
  }
  if (currentSnapshot !== null) {
    undoStack.push(currentSnapshot);
    if (undoStack.length > MAX_HISTORY) undoStack.shift();
  }
  currentSnapshot = fresh;
  redoStack = [];
  notifyListeners();
}

/**
 * Startet die automatische Erfassung. Muss einmal beim App-Start aufgerufen
 * werden (z.B. in App.tsx). Mehrfachaufrufe sind sicher (No-Op ab dem zweiten Mal).
 */
export function initHistoryAutoTracking(): void {
  if (trackingInitialized) return;
  trackingInitialized = true;

  // Ausgangspunkt setzen, BEVOR das Subscribe aktiv wird, damit die erste
  // spätere Änderung einen sinnvollen "davor"-Zustand zum Vergleich hat.
  currentSnapshot = cloneSnapshot();

  useCanvasStore.subscribe((state, prevState) => {
    if (isRestoring) return;
    if (state.shapes === prevState.shapes && state.connectors === prevState.connectors) return;

    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      commitSnapshot();
    }, DEBOUNCE_MS);
  });
}

/** Erzwingt sofortiges Sichern ohne auf das Debounce-Fenster zu warten (z.B. vor kritischen Aktionen). */
export function flushHistorySnapshot(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  commitSnapshot();
}

export function undo(): void {
  flushHistorySnapshot();
  if (undoStack.length === 0 || currentSnapshot === null) {
    return;
  }
  const previous = undoStack.pop()!;
  redoStack.push(currentSnapshot);
  currentSnapshot = previous;
  applySnapshot(previous);
  notifyListeners();
}

export function redo(): void {
  if (redoStack.length === 0 || currentSnapshot === null) return;
  const next = redoStack.pop()!;
  undoStack.push(currentSnapshot);
  currentSnapshot = next;
  applySnapshot(next);
  notifyListeners();
}

export function canUndo(): boolean {
  return undoStack.length > 0;
}

export function canRedo(): boolean {
  return redoStack.length > 0;
}

/** Setzt die History zurück und setzt den aktuellen Stand als neuen Ausgangspunkt (z.B. nach dem Laden einer neuen Datei). */
export function clearHistory(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  undoStack = [];
  redoStack = [];
  currentSnapshot = cloneSnapshot();
  notifyListeners();
}

// Rückwärtskompatibler Alias - alte Aufrufstellen in CanvasEngine.tsx rufen
// weiterhin pushHistorySnapshot() auf; das ist jetzt gleichbedeutend mit
// einem sofortigen Commit und schadet nicht (zusätzlich zur automatischen
// Erfassung), macht sie aber nicht mehr zwingend erforderlich.
export const pushHistorySnapshot = flushHistorySnapshot;

type Listener = () => void;
const listeners = new Set<Listener>();

function notifyListeners() {
  listeners.forEach((l) => l());
}

export function subscribeToHistory(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
