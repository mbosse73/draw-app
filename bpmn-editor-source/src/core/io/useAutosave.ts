import { useEffect, useRef } from "react";
import { useCanvasStore } from "../state/canvasStore";
import { writeAutosave, writeBackup } from "./autosave";
import { writeRotatingBackupToDirectory, getConnectedDirectoryName, loadBackupDirHandle } from "./fileSystemBackup";

const AUTOSAVE_INTERVAL_MS = 15_000; // alle 15 Sekunden bei Änderungen
const BACKUP_INTERVAL_MS = 5 * 60_000; // alle 5 Minuten ein zusätzliches Backup
// Rollierende Backups im verknüpften Ordner laufen bewusst im selben 5-Minuten-
// Takt wie das IndexedDB-Backup (nicht bei jedem 15s-Autosave-Tick) - 5 Kopien
// alle 5 Minuten ergeben 25 Minuten Historie, echte Datei-I/O bei jeder
// Kleinständerung wäre unnötig und würde die 5 Kopien viel zu schnell verbrauchen.
const MAX_DIRECTORY_BACKUPS = 5;

/**
 * Läuft im Hintergrund während die App offen ist: sichert bei Änderungen
 * regelmäßig nach IndexedDB (immer) und - falls der Nutzer einen Ordner
 * verknüpft hat - zusätzlich als rollierende Datei-Kopie in diesen Ordner
 * (siehe fileSystemBackup.ts, `writeRotatingBackupToDirectory`). Rein additiv
 * zum manuellen "Speichern"-Button; ersetzt diesen nicht.
 */
export function useAutosave() {
  const shapes = useCanvasStore((s) => s.shapes);
  const connectors = useCanvasStore((s) => s.connectors);
  const lastSavedRef = useRef<number>(0);
  const lastBackupRef = useRef<number>(0);
  const pendingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Einmal beim Start: einen zuvor verknüpften Backup-Ordner wiederherstellen
  // (der Handle selbst überlebt einen Reload sonst nicht, siehe fileSystemBackup.ts).
  useEffect(() => {
    loadBackupDirHandle();
  }, []);

  useEffect(() => {
    // Debounce: nicht bei jedem einzelnen Zwischenschritt (z.B. während des
    // Ziehens) schreiben, sondern erst wenn kurz Ruhe ist.
    if (pendingRef.current) clearTimeout(pendingRef.current);
    pendingRef.current = setTimeout(async () => {
      const now = Date.now();
      if (now - lastSavedRef.current < AUTOSAVE_INTERVAL_MS) return;
      lastSavedRef.current = now;

      await writeAutosave();

      if (now - lastBackupRef.current > BACKUP_INTERVAL_MS) {
        lastBackupRef.current = now;
        await writeBackup();
        if (getConnectedDirectoryName()) {
          await writeRotatingBackupToDirectory(MAX_DIRECTORY_BACKUPS);
        }
      }
    }, 1500);

    return () => {
      if (pendingRef.current) clearTimeout(pendingRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shapes, connectors]);

  // Zusätzlich: beim Schließen/Verlassen der Seite ein letztes Mal sichern,
  // damit der allerletzte Stand nicht durch das Debounce-Fenster fällt.
  useEffect(() => {
    const handleBeforeUnload = () => {
      writeAutosave();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);
}
