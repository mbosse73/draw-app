import { useState, useRef, useEffect } from "react";
import { settingsToJson, loadSettingsFromJson } from "../Toolbox/settingsIO";
import { downloadTextFile, pickAndReadTextFile } from "../../core/io/fileIo";

function timestampedName(base: string, ext: string): string {
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  return `${base}_${stamp}.${ext}`;
}

/** Dropdown zum Exportieren/Importieren von Einstellungen (aktuell: Favoriten), unabhängig von Diagrammen. */
export function SettingsMenu() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleExport = () => {
    downloadTextFile(settingsToJson(), timestampedName("einstellungen", "json"), "application/json");
    setOpen(false);
  };

  const handleImport = async () => {
    const content = await pickAndReadTextFile(".json,application/json");
    if (content === null) return;
    const result = loadSettingsFromJson(content);
    if (!result.success) {
      alert("Einstellungen konnten nicht geladen werden: " + result.error);
      return;
    }
    setOpen(false);
  };

  return (
    <div className="toolbar-menu" ref={menuRef}>
      <button onClick={() => setOpen((o) => !o)} title="Einstellungen (z.B. Favoriten) sichern/laden">
        Einstellungen ▾
      </button>
      {open && (
        <div className="toolbar-menu-dropdown">
          <button onClick={handleExport}>Einstellungen exportieren…</button>
          <button onClick={handleImport}>Einstellungen importieren…</button>
        </div>
      )}
    </div>
  );
}
