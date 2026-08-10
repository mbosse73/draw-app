import { useModalDialog } from "../useModalDialog";

interface ShortcutEntry {
  keys: string;
  description: string;
}

interface ShortcutGroup {
  title: string;
  entries: ShortcutEntry[];
  /** Spannt beide Grid-Spalten (für besonders lange Gruppen wie "Bearbeiten"). */
  wide?: boolean;
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: "Ansicht",
    entries: [
      { keys: "Mausrad", description: "Zoomen (zentriert um Mauszeiger)" },
      { keys: "Linksklick + Ziehen (leere Fläche)", description: "Zeichenfläche verschieben" },
      { keys: "Leertaste + Linksklick", description: "Zeichenfläche verschieben (Alternative)" },
      { keys: "Mittlere Maustaste", description: "Zeichenfläche verschieben (Alternative)" },
      { keys: "Klick auf Zoom-Anzeige", description: "Zoom-Wert direkt eingeben" },
    ],
  },
  {
    title: "Auswahl",
    entries: [
      { keys: "Klick", description: "Element auswählen" },
      { keys: "Shift + Klick", description: "Element zur Auswahl hinzufügen/entfernen" },
      { keys: "Shift + Ziehen (leere Fläche)", description: "Auswahlrechteck aufziehen" },
      { keys: "Strg + A", description: "Alle Elemente auswählen" },
      { keys: "Esc", description: "Aktion abbrechen (z.B. Verbindung ziehen)" },
    ],
  },
  {
    title: "Verbindungen",
    entries: [
      { keys: "Ziehen von einem Port", description: "Neue Verbindung erstellen" },
      { keys: "Ziehen an Endpunkt-Griff", description: "Verbindung lösen und neu andocken" },
      { keys: "Ziehen an Liniensegment", description: "Manuellen Wegpunkt hinzufügen" },
      { keys: "Doppelklick auf Wegpunkt", description: "Wegpunkt entfernen" },
    ],
  },
  {
    title: "Sonstiges",
    entries: [
      { keys: "F1", description: "Diese Hilfe anzeigen" },
      { keys: "Alt + M", description: "Hell-/Dunkelmodus umschalten" },
    ],
  },
  {
    title: "Bearbeiten",
    wide: true,
    entries: [
      { keys: "Entf / Rücktaste", description: "Ausgewählte Elemente löschen" },
      { keys: "Strg + C", description: "Kopieren" },
      { keys: "Strg + V", description: "Einfügen" },
      { keys: "Strg + Z", description: "Rückgängig" },
      { keys: "Strg + Y (oder Strg+Shift+Z)", description: "Wiederholen" },
      { keys: "Strg + G", description: "Ausgewählte Elemente gruppieren" },
      { keys: "Strg + Shift + G", description: "Gruppierung aufheben" },
      { keys: "Pfeiltasten", description: "Ausgewählte Elemente um 1px verschieben" },
      { keys: "Shift + Pfeiltasten", description: "Ausgewählte Elemente um eine Rastereinheit verschieben" },
      { keys: "Doppelklick auf Element/Verbindung", description: "Text bearbeiten" },
      { keys: "Strg/Cmd + Enter (im Textfeld)", description: "Texteingabe bestätigen" },
      { keys: "Esc (im Textfeld)", description: "Texteingabe verwerfen" },
    ],
  },
];

export function ShortcutOverlay({ onClose }: { onClose: () => void }) {
  const dialogRef = useModalDialog(onClose);

  return (
    <dialog ref={dialogRef} className="modal-panel modal-panel--shortcuts">
      <div className="modal-header">
        <h3>Tastaturkürzel</h3>
        <button className="modal-close" onClick={() => dialogRef.current?.close()} title="Schließen">
          ×
        </button>
      </div>
      <div className="modal-body shortcut-grid">
        {SHORTCUT_GROUPS.map((group) => (
          <div key={group.title} className={group.wide ? "shortcut-group shortcut-group--wide" : "shortcut-group"}>
            <h4>{group.title}</h4>
            <table className="shortcut-table">
              <tbody>
                {group.entries.map((entry) => (
                  <tr key={entry.keys}>
                    <td className="shortcut-keys">{entry.keys}</td>
                    <td>{entry.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </dialog>
  );
}
