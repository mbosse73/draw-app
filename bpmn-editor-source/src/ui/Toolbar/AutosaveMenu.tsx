import { useState, useRef, useEffect } from "react";
import {
  isFileSystemAccessSupported,
  connectBackupDirectory,
  disconnectBackupDirectory,
  getConnectedDirectoryName,
  getBackupDirPermissionStatus,
  ensureBackupDirPermission,
} from "../../core/io/fileSystemBackup";
import { listBackups, restoreBackup, type BackupEntry } from "../../core/io/autosave";
import { showToast } from "../Toast/toastStore";

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
  // "unavailable" wird auch als Anfangswert genutzt, bis die erste async
  // Prüfung durchgelaufen ist - der Hinweisbutton erscheint erst, sobald
  // wirklich "prompt" oder "denied" bestätigt wurde, nie voreilig.
  const [needsPermission, setNeedsPermission] = useState(false);
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

  // Bei jedem Öffnen neu prüfen: nach einem Browser-Neustart ist die
  // Berechtigung eines wiederhergestellten Ordner-Handles oft auf "prompt"
  // zurückgefallen (siehe fileSystemBackup.ts), das muss sichtbar sein.
  useEffect(() => {
    if (!open || !directoryName) return;
    getBackupDirPermissionStatus().then((status) => setNeedsPermission(status !== "granted"));
  }, [open, directoryName]);

  const handleConnect = async () => {
    const name = await connectBackupDirectory();
    if (name) {
      setDirectoryName(name);
      setNeedsPermission(false);
      showToast(`Backup-Ordner verknüpft: ${name}`, "success");
    }
  };

  const handleDisconnect = async () => {
    await disconnectBackupDirectory();
    setDirectoryName(null);
    showToast("Backup-Ordner getrennt", "info");
  };

  const handleReconfirmPermission = async () => {
    const granted = await ensureBackupDirPermission();
    setNeedsPermission(!granted);
    showToast(granted ? "Berechtigung bestätigt" : "Berechtigung wurde nicht erteilt", granted ? "success" : "error");
  };

  const handleShowBackups = async () => {
    const entries = await listBackups();
    setBackups(entries);
    setShowBackups(true);
  };

  const handleRestoreBackup = async (key: string) => {
    const confirmed = window.confirm("Der aktuelle Arbeitsstand wird durch dieses Backup ersetzt. Fortfahren?");
    if (!confirmed) return;
    const ok = await restoreBackup(key);
    setOpen(false);
    setShowBackups(false);
    showToast(ok ? "Backup wiederhergestellt" : "Backup konnte nicht geladen werden", ok ? "success" : "error");
  };

  return (
    <div className="toolbar-menu" ref={menuRef}>
      <button onClick={() => setOpen((o) => !o)} title="Auto-Save-Einstellungen">
        Auto-Save {directoryName ? "✓" : ""} ▸
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
                    <p className="autosave-info">
                      Verknüpfter Ordner: <strong>{directoryName}</strong> — wird als Startordner für
                      "Speichern" vorausgewählt und erhält zusätzlich bis zu 5 rollierende Auto-Backups.
                    </p>
                    {needsPermission && (
                      <>
                        <p className="autosave-info autosave-info--warn">
                          Berechtigung wurde vom Browser zurückgesetzt (z.B. nach Neustart).
                        </p>
                        <button onClick={handleReconfirmPermission}>Berechtigung bestätigen…</button>
                      </>
                    )}
                    <button onClick={handleDisconnect}>Ordner trennen</button>
                  </>
                ) : (
                  <button onClick={handleConnect}>Ordner für Speichern & Backup wählen…</button>
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
