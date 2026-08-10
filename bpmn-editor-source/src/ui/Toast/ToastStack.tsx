import { useEffect, useState } from "react";
import { useToastStore, type ToastEntry } from "./toastStore";

const ICONS = { success: "✓", error: "⚠", info: "ℹ" } as const;
const FADE_MS = 260;

function Toast({ entry }: { entry: ToastEntry }) {
  const removeToast = useToastStore((s) => s.removeToast);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const showFrame = requestAnimationFrame(() => setVisible(true));
    const hideTimer = setTimeout(() => setVisible(false), entry.durationMs);
    const removeTimer = setTimeout(() => removeToast(entry.id), entry.durationMs + FADE_MS);
    return () => {
      cancelAnimationFrame(showFrame);
      clearTimeout(hideTimer);
      clearTimeout(removeTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry.id, entry.durationMs]);

  return (
    <div className={visible ? `toast toast--${entry.type} toast--visible` : `toast toast--${entry.type}`}>
      <span className="toast-icon">{ICONS[entry.type]}</span>
      <span>{entry.message}</span>
    </div>
  );
}

/** Einmal auf App-Ebene gemountet (siehe App.tsx); rendert alle aktiven Toasts. */
export function ToastStack() {
  const toasts = useToastStore((s) => s.toasts);
  return (
    <div className="toast-stack">
      {toasts.map((entry) => (
        <Toast key={entry.id} entry={entry} />
      ))}
    </div>
  );
}
