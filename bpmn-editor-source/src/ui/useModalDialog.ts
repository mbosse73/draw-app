import { useEffect, useRef } from "react";

/**
 * Verdrahtet ein natives <dialog>-Element nach UI-DESIGNGUIDE.md Abschnitt 5/6:
 * öffnet es beim Mounten per showModal() (Escape schließt es dann automatisch
 * per Browser-Verhalten), synchronisiert einen so entstehenden nativen Close
 * zurück in den React-State über `onClose` - sonst hätte die Elternkomponente
 * (App.tsx) noch `showHelp=true` im State, während das <dialog> längst
 * (unsichtbar) geschlossen ist, und ein erneuter Klick auf "Hilfe" würde
 * scheinbar nichts tun. Backdrop-Klick schließt zusätzlich, aber nur wenn
 * SOWOHL mousedown als auch mouseup auf dem <dialog>-Element selbst (nicht
 * einem Kind) gelandet sind - verhindert das versehentliche Schließen beim
 * Markieren von Text bis an den Dialogrand (mousedown auf Backdrop, mouseup
 * im Inhalt oder umgekehrt).
 */
export function useModalDialog(onClose: () => void) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    dialog.showModal();

    const handleClose = () => onClose();
    dialog.addEventListener("close", handleClose);

    let backdropMouseDown = false;
    const handleMouseDown = (e: MouseEvent) => {
      backdropMouseDown = e.target === dialog;
    };
    const handleMouseUp = (e: MouseEvent) => {
      if (backdropMouseDown && e.target === dialog) dialog.close();
      backdropMouseDown = false;
    };
    dialog.addEventListener("mousedown", handleMouseDown);
    dialog.addEventListener("mouseup", handleMouseUp);

    return () => {
      dialog.removeEventListener("close", handleClose);
      dialog.removeEventListener("mousedown", handleMouseDown);
      dialog.removeEventListener("mouseup", handleMouseUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return ref;
}
