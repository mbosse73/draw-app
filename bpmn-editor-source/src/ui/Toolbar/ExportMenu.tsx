import { useState, useRef, useEffect } from "react";
import { diagramToJson } from "../../core/io/diagramSerializer";
import { useFavoritesStore } from "../Toolbox/favoritesStore";
import { downloadTextFile, downloadBlob } from "../../core/io/fileIo";
import { buildExportSvg, exportDiagramAsPng } from "../../core/io/imageExport";
import { buildBpmnXml, summarizeBpmnCoverage } from "../../modules/bpmn/io/bpmnXmlExport";
import { buildDrawioXml } from "../../modules/bpmn/io/drawioExport";
import { showToast } from "../Toast/toastStore";

function timestampedName(base: string, ext: string): string {
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  return `${base}_${stamp}.${ext}`;
}

export function ExportMenu() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleExportJson = () => {
    downloadTextFile(diagramToJson(useFavoritesStore.getState().favoriteTypes), timestampedName("diagramm", "json"), "application/json");
    setOpen(false);
    showToast("Als JSON exportiert", "success");
  };

  // F-10: BPMN-XML kann nur BPMN-Elemente aufnehmen. Enthaelt das Diagramm
  // keine, waere die Datei leer - dann gar nicht erst herunterladen, sondern
  // erklaeren warum. Sind nur einzelne Elemente nicht abbildbar (gemischtes
  // Diagramm), wird exportiert, aber die Zahl der uebergangenen Elemente
  // genannt, damit niemand von einem stillen Verlust ueberrascht wird.
  const handleExportBpmnXml = () => {
    const { abbildbar, uebergangen } = summarizeBpmnCoverage();
    if (abbildbar === 0) {
      setOpen(false);
      showToast(
        "Dieses Diagramm enthält keine BPMN-Elemente - eine BPMN-Datei wäre leer. Für Wireframes eignen sich SVG, PNG oder JSON.",
        "error"
      );
      return;
    }
    downloadTextFile(buildBpmnXml(), timestampedName("diagramm", "bpmn"), "application/xml");
    setOpen(false);
    showToast(
      uebergangen > 0
        ? `Als BPMN 2.0 XML exportiert - ${uebergangen} Element(e) ohne BPMN-Entsprechung wurden übergangen`
        : "Als BPMN 2.0 XML exportiert",
      uebergangen > 0 ? "info" : "success"
    );
  };

  const handleExportDrawio = () => {
    downloadTextFile(buildDrawioXml(), timestampedName("diagramm", "drawio"), "application/xml");
    setOpen(false);
    showToast("Als draw.io XML exportiert", "success");
  };

  const handleExportSvg = () => {
    downloadTextFile(buildExportSvg(), timestampedName("diagramm", "svg"), "image/svg+xml");
    setOpen(false);
    showToast("Als SVG exportiert", "success");
  };

  const handleExportPng = async () => {
    setBusy(true);
    try {
      const blob = await exportDiagramAsPng(2);
      downloadBlob(blob, timestampedName("diagramm", "png"));
      showToast("Als PNG exportiert", "success");
    } catch (err) {
      console.error(err);
      showToast("PNG-Export fehlgeschlagen: " + (err instanceof Error ? err.message : "Unbekannter Fehler"), "error");
    } finally {
      setBusy(false);
      setOpen(false);
    }
  };

  // Kein PDF-Generator als Abhängigkeit (Projekt bleibt bewusst frei von
  // Laufzeit-Abhängigkeiten außer react/react-dom/zustand, siehe Doku) -
  // stattdessen der native Browser-Druckdialog, aus dem heraus sich jede
  // Zieldruckerauswahl auch "Als PDF speichern" anbietet.
  const handlePrint = () => {
    const svgString = buildExportSvg();
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      showToast("Pop-up wurde blockiert. Bitte Pop-ups für diese Seite erlauben, um zu drucken.", "error");
      return;
    }
    printWindow.document.write(`<!doctype html>
<html>
  <head>
    <title>Diagramm drucken</title>
    <style>
      @page { margin: 10mm; }
      html, body { margin: 0; padding: 0; }
      body { display: flex; align-items: center; justify-content: center; }
      svg { max-width: 100%; height: auto; }
    </style>
  </head>
  <body>${svgString}</body>
</html>`);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
    };
    setOpen(false);
  };

  return (
    <div className="toolbar-menu" ref={menuRef}>
      <button onClick={() => setOpen((o) => !o)} disabled={busy}>
        {busy ? "Exportiere…" : "Export ▸"}
      </button>
      {open && (
        <div className="toolbar-menu-dropdown">
          <button onClick={handleExportSvg}>Als SVG (Vektor)</button>
          <button onClick={handleExportPng}>Als PNG (Bild)</button>
          <div className="toolbar-menu-divider" />
          <button onClick={handleExportBpmnXml}>Als BPMN 2.0 XML</button>
          <button onClick={handleExportDrawio}>Als draw.io XML</button>
          <button onClick={handleExportJson}>Als JSON</button>
          <div className="toolbar-menu-divider" />
          <button onClick={handlePrint}>Drucken / Als PDF</button>
        </div>
      )}
    </div>
  );
}
