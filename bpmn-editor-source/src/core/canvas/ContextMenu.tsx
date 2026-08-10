import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface ContextMenuItem {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

export interface ContextMenuSection {
  items: ContextMenuItem[];
}

interface ContextMenuProps {
  x: number;
  y: number;
  sections: ContextMenuSection[];
  onClose: () => void;
}

/**
 * Generisches Rechtsklick-Kontextmenü für die Zeichenfläche. Kennt selbst
 * keine konkreten Aktionen - CanvasEngine.tsx baut die Sections/Items
 * (Duplizieren, Ausrichten, Verbindungstyp, ...) und übergibt sie fertig.
 */
// Rand zum Fensterrand (px), den das Menü beim Umklappen einhält.
const VIEWPORT_MARGIN = 8;

export function ContextMenu({ x, y, sections, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  // Erst nach dem Messen der tatsächlichen Menügröße wird die endgültige
  // Position gesetzt (siehe useLayoutEffect unten) - bis dahin unsichtbar
  // gerendert, damit kein falsch positionierter Frame aufblitzt.
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  // Menü immer direkt am Mauszeiger öffnen, aber so umklappen (nach links/
  // oben statt rechts/unten), dass es komplett im sichtbaren Fenster
  // bleibt - unabhängig davon wie lang es durch die Sections gerade ist.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { offsetWidth: w, offsetHeight: h } = el;
    let left = x;
    let top = y;
    if (left + w > window.innerWidth - VIEWPORT_MARGIN) {
      left = x - w;
    }
    if (top + h > window.innerHeight - VIEWPORT_MARGIN) {
      top = y - h;
    }
    left = Math.max(VIEWPORT_MARGIN, Math.min(left, window.innerWidth - w - VIEWPORT_MARGIN));
    top = Math.max(VIEWPORT_MARGIN, Math.min(top, window.innerHeight - h - VIEWPORT_MARGIN));
    setPos({ left, top });
  }, [x, y, sections]);

  // Per Portal direkt unter <body> gerendert, NICHT innerhalb von
  // .canvas-area: .canvas-area setzt bewusst `contain: layout` (siehe
  // App.css-Kommentar dort, Layout-Isolation der Panels) - das macht es aber
  // per CSS-Spec zum Containing Block für alle `position: fixed`-Nachfahren,
  // wodurch unsere Viewport-Koordinaten (e.clientX/Y, window.innerWidth/
  // Height) ohne Portal komplett falsch verortet würden (Menü "weit weg vom
  // Mauszeiger"). Ein Portal umgeht das unabhängig davon, welcher Vorfahre
  // gerade `contain`/`transform`/`filter` setzt.
  return createPortal(
    <div
      ref={ref}
      className="context-menu"
      style={{
        left: pos ? pos.left : x,
        top: pos ? pos.top : y,
        visibility: pos ? "visible" : "hidden",
      }}
    >
      {sections.map((section, i) => (
        <div key={i} className="context-menu-section">
          {i > 0 && <div className="context-menu-divider" />}
          {section.items.map((item) => (
            <button
              key={item.label}
              disabled={item.disabled}
              onClick={() => {
                item.onClick();
                onClose();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ))}
    </div>,
    document.body
  );
}
