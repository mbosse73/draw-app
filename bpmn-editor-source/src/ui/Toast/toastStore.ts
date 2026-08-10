import { create } from "zustand";

export type ToastType = "success" | "error" | "info";

export interface ToastEntry {
  id: string;
  message: string;
  type: ToastType;
  durationMs: number;
}

interface ToastState {
  toasts: ToastEntry[];
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  removeToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

/**
 * Nicht-blockierendes Feedback statt `alert()`/`confirm()` für Erfolgs- und
 * Fehlermeldungen (siehe BACKUP-SYSTEM-ANWEISUNG.md, Abschnitt 2). Bewusst
 * eine freie Funktion statt eines Hooks - so aus jedem Event-Handler, jeder
 * async-Funktion und jedem Nicht-Komponenten-Modul aufrufbar (z.B. aus
 * core/io/*.ts), ohne dass diese Module React kennen müssen.
 * `confirm()` bleibt bewusst weiterhin für destruktive Bestätigungen
 * (Restore/Import/Überschreiben) im Einsatz - dafür ist dies kein Ersatz.
 */
export function showToast(message: string, type: ToastType = "info", durationMs?: number): void {
  const resolvedDuration = durationMs ?? (type === "error" ? 4500 : 2400);
  const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  useToastStore.setState((state) => ({
    toasts: [...state.toasts, { id, message, type, durationMs: resolvedDuration }],
  }));
}
