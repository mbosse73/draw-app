import { useThemeStore } from "./themeStore";

/** Umschalter Hell-/Dunkelmodus, siehe UI-DESIGNGUIDE.md Abschnitt 3. Tastenkürzel Alt+M ist global in App.tsx verdrahtet. */
export function ThemeToggleButton() {
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);

  return (
    <button
      className="theme-toggle-btn"
      onClick={toggleTheme}
      title={theme === "light" ? "Zu Dunkelmodus wechseln (Alt+M)" : "Zu Hellmodus wechseln (Alt+M)"}
    >
      {theme === "light" ? "☀ Hell" : "🌙 Dunkel"}
    </button>
  );
}
