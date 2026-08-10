import { useFavoritesStore } from "./favoritesStore";

/**
 * Format für den eigenständigen Einstellungs-Export - bewusst getrennt vom
 * Diagramm-Format (DiagramFile), da Einstellungen unabhängig von einem
 * konkreten Diagramm sind und auf einen anderen Rechner/Browser übertragen
 * werden können sollen, ohne ein Diagramm mitzuschleppen.
 */
export interface SettingsFile {
  formatVersion: 1;
  createdAt: string;
  favorites: string[];
}

export function serializeSettings(): SettingsFile {
  return {
    formatVersion: 1,
    createdAt: new Date().toISOString(),
    favorites: Array.from(useFavoritesStore.getState().favoriteTypes),
  };
}

export function settingsToJson(): string {
  return JSON.stringify(serializeSettings(), null, 2);
}

export type LoadSettingsResult = { success: true; favoriteCount: number } | { success: false; error: string };

/** Lädt Einstellungen aus einer Datei; Favoriten werden additiv übernommen (bestehende bleiben erhalten). */
export function loadSettingsFromJson(json: string): LoadSettingsResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { success: false, error: "Die Datei enthält kein gültiges JSON." };
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("favorites" in parsed) ||
    !Array.isArray((parsed as SettingsFile).favorites)
  ) {
    return { success: false, error: "Die Datei hat nicht das erwartete Einstellungs-Format." };
  }

  const favorites = (parsed as SettingsFile).favorites.filter((f): f is string => typeof f === "string");
  useFavoritesStore.getState().mergeFavorites(favorites);
  return { success: true, favoriteCount: favorites.length };
}
