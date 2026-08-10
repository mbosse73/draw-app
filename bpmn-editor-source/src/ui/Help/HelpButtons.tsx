interface HelpButtonsProps {
  onShowShortcuts: () => void;
  onShowHelp: () => void;
}

/** Toolbar-Buttons zum Öffnen von Tastenkürzel-Übersicht und Hilfe. */
export function HelpButtons({ onShowShortcuts, onShowHelp }: HelpButtonsProps) {
  return (
    <>
      <button onClick={onShowShortcuts} title="Tastaturkürzel anzeigen">
        Tastaturkürzel
      </button>
      <button onClick={onShowHelp} title="Hilfe anzeigen (F1)">
        Hilfe <span className="menu-shortcut">F1</span>
      </button>
    </>
  );
}
