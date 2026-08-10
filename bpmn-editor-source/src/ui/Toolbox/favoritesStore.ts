import { create } from "zustand";

const STORAGE_KEY = "bpmn-editor-favorites";

interface FavoritesState {
  favoriteTypes: Set<string>;
  toggleFavorite: (shapeType: string) => void;
  isFavorite: (shapeType: string) => boolean;
  /** Ersetzt die komplette Favoritenliste (z.B. beim Importieren aus einer Datei). */
  setFavorites: (shapeTypes: string[]) => void;
  /** Fügt Favoriten hinzu, ohne bestehende zu entfernen (z.B. beim Laden eines
   *  Diagramms mit mitgespeicherten Favoriten - additiv statt ersetzend, damit
   *  bereits vorhandene persönliche Favoriten nicht verloren gehen). */
  mergeFavorites: (shapeTypes: string[]) => void;
}

/** Liest die gespeicherten Favoriten synchron beim Start (localStorage ist synchron verfügbar). */
function loadFavoritesFromStorage(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((v): v is string => typeof v === "string"));
  } catch {
    // localStorage kann in seltenen Fällen blockiert sein (z.B. striktes
    // Privatsphäre-Setting) oder enthält beschädigte Daten - dann einfach
    // ohne gespeicherte Favoriten starten, statt die App abstürzen zu lassen.
    return new Set();
  }
}

function saveFavoritesToStorage(favoriteTypes: Set<string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(favoriteTypes)));
  } catch {
    // Speichern kann fehlschlagen (z.B. Speicherkontingent voll oder
    // localStorage deaktiviert) - die Markierung bleibt dann nur für die
    // aktuelle Sitzung erhalten, was besser ist als ein harter Fehler.
  }
}

/**
 * Separater, kleiner Store nur für Favoriten-Markierungen in der Toolbox.
 * Bewusst getrennt vom canvasStore: Favoriten sind eine reine UI-Präferenz
 * des Nutzers, kein Bestandteil eines Diagramms, und sollen daher auch
 * nicht in Diagramm-Exporte (JSON/XML) einfließen oder von Undo/Redo erfasst
 * werden. Persistiert in localStorage (synchron, einfach, für diese kleine
 * Datenmenge ausreichend - im Gegensatz zum asynchronen IndexedDB-Autosave
 * für ganze Diagramme).
 */
export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  favoriteTypes: loadFavoritesFromStorage(),

  toggleFavorite: (shapeType) =>
    set((state) => {
      const next = new Set(state.favoriteTypes);
      if (next.has(shapeType)) next.delete(shapeType);
      else next.add(shapeType);
      saveFavoritesToStorage(next);
      return { favoriteTypes: next };
    }),

  isFavorite: (shapeType) => get().favoriteTypes.has(shapeType),

  setFavorites: (shapeTypes) => {
    const next = new Set(shapeTypes);
    saveFavoritesToStorage(next);
    set({ favoriteTypes: next });
  },

  mergeFavorites: (shapeTypes) => {
    set((state) => {
      const next = new Set(state.favoriteTypes);
      shapeTypes.forEach((t) => next.add(t));
      saveFavoritesToStorage(next);
      return { favoriteTypes: next };
    });
  },
}));
