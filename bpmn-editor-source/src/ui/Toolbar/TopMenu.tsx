import { useEffect, useRef, type ReactNode } from "react";

interface TopMenuProps {
  id: string;
  label: string;
  openMenu: string | null;
  onOpen: (id: string) => void;
  onClose: () => void;
  children: (close: () => void) => ReactNode;
  /** Zusätzliche Klasse für das Dropdown-Element, z.B. um pro Menü das
   *  `overflow-y: auto`-Sicherheitsnetz aus .toolbar-menu-dropdown gezielt
   *  zu überschreiben (siehe App.css, "Datei"-Menü mit Export/Auto-Save
   *  Untermenüs). */
  dropdownClassName?: string;
}

/**
 * Ein Dropdown der obersten Menüleiste (Datei/Bearbeiten/Ansicht/...), siehe
 * MenuBar.tsx. Anders als die älteren einzelnen `.toolbar-menu`-Buttons
 * (ExportMenu, AutosaveMenu, ...) wird der Offen-Zustand vom Elternteil
 * zentral verwaltet (`openMenu` in MenuBar) - dadurch kann bei bereits
 * geöffneter Menüleiste ein Hover auf ein Nachbarmenü direkt umschalten,
 * wie in nativen Anwendungsmenüs üblich, statt Schließen-dann-neu-Klicken
 * zu erfordern.
 */
export function TopMenu({ id, label, openMenu, onOpen, onClose, children, dropdownClassName }: TopMenuProps) {
  const isOpen = openMenu === id;
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  return (
    <div className="menubar-item" ref={ref} onMouseEnter={() => { if (openMenu !== null && openMenu !== id) onOpen(id); }}>
      <button
        className={isOpen ? "menubar-trigger menubar-trigger--active" : "menubar-trigger"}
        onClick={() => (isOpen ? onClose() : onOpen(id))}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        {label}
      </button>
      {isOpen && (
        <div className={dropdownClassName ? `menubar-dropdown toolbar-menu-dropdown ${dropdownClassName}` : "menubar-dropdown toolbar-menu-dropdown"}>
          {children(onClose)}
        </div>
      )}
    </div>
  );
}
