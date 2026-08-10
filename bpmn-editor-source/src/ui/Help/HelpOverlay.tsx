import { useState } from "react";
import { useModalDialog } from "../useModalDialog";

interface HelpSection {
  id: string;
  title: string;
  content: React.ReactNode;
}

const SECTIONS: HelpSection[] = [
  {
    id: "start",
    title: "Erste Schritte",
    content: (
      <>
        <p>
          Ziehe Elemente aus der Toolbox links auf die Zeichenfläche. Verbinde Elemente, indem du den Mauszeiger über
          ein Element bewegst (kleine Kreise erscheinen an den Rändern) und von dort zu einem anderen Element ziehst.
        </p>
        <p>
          Doppelklick auf ein Element öffnet die Textbearbeitung. Ein Klick auf ein Element zeigt seine Eigenschaften
          im Panel rechts.
        </p>
      </>
    ),
  },
  {
    id: "navigation",
    title: "Navigation",
    content: (
      <>
        <p>Mit dem Mausrad zoomst du hinein und heraus. Ein einfacher Linksklick auf die leere Fläche und Ziehen verschiebt die Ansicht.</p>
        <p>Der Zoom-Wert in der Toolbar lässt sich anklicken, um eine exakte Prozentzahl einzugeben.</p>
      </>
    ),
  },
  {
    id: "elements",
    title: "Elemente & Verbindungen",
    content: (
      <>
        <p>
          Die Toolbox enthält Ereignisse (inkl. Timer-, Nachrichten- und Fehler-Varianten), Aktivitäten (Tasks und
          Sub-Prozesse), Gateways, Datenobjekte sowie Pools und Lanes.
        </p>
        <p>
          Ein Sub-Prozess lässt sich über das kleine +/− Symbol auf-/zuklappen. Im aufgeklappten Zustand können
          Elemente hineingezogen werden.
        </p>
        <p>
          Boundary Events (Timer/Nachricht/Fehler) werden direkt auf einen Task gezogen und heften sich automatisch
          an dessen Rand.
        </p>
        <p>
          Verbindungen können als Sequenzfluss, Nachrichtenfluss oder Assoziation dargestellt werden — die Auswahl
          erfolgt im Eigenschaften-Panel nach dem Selektieren einer Verbindung.
        </p>
        <p>
          Verbindungen weichen anderen Elementen automatisch aus. Für einen manuellen Verlauf kannst du an einer
          Linie ziehen, um einen Wegpunkt zu setzen; ein Doppelklick auf einen Wegpunkt entfernt ihn wieder.
        </p>
      </>
    ),
  },
  {
    id: "organizing",
    title: "Elemente organisieren",
    content: (
      <>
        <p>
          Mehrere Elemente lassen sich per Shift-Klick oder durch Aufziehen eines Auswahlrahmens (Shift + Ziehen auf
          leerer Fläche) gemeinsam markieren und verschieben.
        </p>
        <p>Mit Strg+G lässt sich eine feste Gruppe bilden; ein Klick auf ein Gruppenmitglied wählt dann die ganze Gruppe.</p>
        <p>Der „Auto-Layout"-Button ordnet alle frei platzierten Elemente automatisch in einem übersichtlichen Schichten-Layout an.</p>
      </>
    ),
  },
  {
    id: "saving",
    title: "Speichern & Exportieren",
    content: (
      <>
        <p>
          Der Arbeitsstand wird automatisch im Browser gesichert. Über „Öffnen…" und „Speichern" lässt sich der
          Stand zusätzlich als Datei sichern und wieder laden.
        </p>
        <p>
          Über „Export" stehen SVG, PNG, BPMN 2.0 XML und JSON zur Verfügung. Optional lässt sich unter „Auto-Save"
          ein Ordner auf der Festplatte verknüpfen (nur Chrome/Edge), in den zusätzlich gesichert wird.
        </p>
      </>
    ),
  },
  {
    id: "shortcuts",
    title: "Tastaturkürzel",
    content: (
      <p>
        Eine vollständige Übersicht aller Tastaturkürzel findest du über den Button „Tastaturkürzel" in der Toolbar
        oder jederzeit per Taste F1.
      </p>
    ),
  },
];

export function HelpOverlay({ onClose }: { onClose: () => void }) {
  const [activeSection, setActiveSection] = useState(SECTIONS[0].id);
  const current = SECTIONS.find((s) => s.id === activeSection) ?? SECTIONS[0];
  const dialogRef = useModalDialog(onClose);

  return (
    <dialog ref={dialogRef} className="modal-panel modal-panel--wide">
      <div className="modal-header">
        <h3>Hilfe</h3>
        <button className="modal-close" onClick={() => dialogRef.current?.close()} title="Schließen">
          ×
        </button>
      </div>
      <div className="help-layout">
        <nav className="help-nav">
          {SECTIONS.map((section) => (
            <button
              key={section.id}
              className={section.id === activeSection ? "help-nav-item help-nav-item--active" : "help-nav-item"}
              onClick={() => setActiveSection(section.id)}
            >
              {section.title}
            </button>
          ))}
        </nav>
        <div className="help-content">
          <h4>{current.title}</h4>
          {current.content}
        </div>
      </div>
    </dialog>
  );
}
