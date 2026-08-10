import { useState, useRef, useEffect } from "react";
import {
  isFileSystemAccessSupported,
  connectBackupDirectory,
  disconnectBackupDirectory,
  getConnectedDirectoryName,
} from "../../core/io/fileSystemBackup";
import { listBackups, restoreBackup, type BackupEntry } from "../../core/io/autosave";

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AutosaveMenu() {
  const [open, setOpen] = useState(false);
  const [directoryName, setDirectoryName] = useState<string | null>(getConnectedDirectoryName());
  const [backups, setBackups] = useState<BackupEntry[]>([]);
  const [showBackups, setShowBackups] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const supported = isFileSystemAccessSupported();

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
        setShowBackups(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleConnect = async () => {
    const name = await connectBackupDirectory();
    if (name) setDirectoryName(name);
  };

  const handleDisconnect = () => {
    disconnectBackupDirectory();
    setDirectoryName(null);
  };

  const handleShowBackups = async () => {
    const entries = await listBackups();
    setBackups(entries);
    setShowBackups(true);
  };

  const handleRestoreBackup = async (key: string) => {
    const confirmed = window.confirm("Der aktuelle Arbeitsstand wird durch dieses Backup ersetzt. Fortfahren?");
    if (!confirmed) return;
    await restoreBackup(key);
    setOpen(false);
    setShowBackups(false);
  };

  return (
    <div className="toolbar-menu" ref={menuRef}>
      <button onClick={() => setOpen((o) => !o)} title="Auto-Save-Einstellungen">
        Auto-Save {directoryName ? "✓" : ""} ▾
      </button>
      {open && (
        <div className="toolbar-menu-dropdown autosave-dropdown">
          {!showBackups ? (
            <>
              <p className="autosave-info">
                Der Arbeitsstand wird automatisch im Browser gesichert (IndexedDB), unabhängig von dieser
                Einstellung.
              </p>
              {supported ? (
                directoryName ? (
                  <>
                    <p className="autosave-info">Zusätzlich verknüpft: <strong>{directoryName}</strong></p>
                    <button onClick={handleDisconnect}>Ordner trennen</button>
                  </>
                ) : (
                  <button onClick={handleConnect}>Ordner für Backup wählen…</button>
                )
              ) : (
                <p className="autosave-info">
                  Ordner-Verknüpfung wird von diesem Browser nicht unterstützt (nur Chrome/Edge).
                </p>
              )}
              <div className="toolbar-menu-divider" />
              <button onClick={handleShowBackups}>Frühere Backups ansehen…</button>
            </>
          ) : (
            <>
              <button onClick={() => setShowBackups(false)}>← Zurück</button>
              <div className="toolbar-menu-divider" />
              {backups.length === 0 && <p className="autosave-info">Noch keine Backups vorhanden.</p>}
              {backups.map((b) => (
                <button key={b.key} onClick={() => handleRestoreBackup(b.key)} className="autosave-backup-item">
                  {formatTimestamp(b.timestamp)} · {b.shapeCount} Elemente
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
