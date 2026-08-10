import { create } from "zustand";

export type Theme = "light" | "dark";

const THEME_KEY = "bpmnEditorTheme";

function readInitialTheme(): Theme {
  try {
    return localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

function applyThemeToDocument(theme: Theme): void {
  if (theme === "light") document.documentElement.setAttribute("data-theme", "light");
  else document.documentElement.removeAttribute("data-theme");
}

interface ThemeState {
  theme: Theme;
  toggleTheme: () => void;
}

/**
 * Dunkelmodus als Standard, siehe UI-DESIGNGUIDE.md Abschnitt 1/3. Der
 * initiale Wert liest dieselbe localStorage-Quelle wie das Flicker-Fix-
 * Skript in index.html - beide müssen synchron bleiben, sonst weicht der
 * Store-Zustand vom bereits gerenderten `data-theme`-Attribut ab.
 */
export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: readInitialTheme(),
  toggleTheme: () => {
    const next: Theme = get().theme === "light" ? "dark" : "light";
    applyThemeToDocument(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // localStorage evtl. nicht verfügbar (z.B. privates Fenster) -
      // Theme gilt dann nur für die laufende Sitzung, kein Absturz.
    }
    set({ theme: next });
  },
}));
