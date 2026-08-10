import { useState, useRef, useEffect } from "react";
import { diagramToJson } from "../../core/io/diagramSerializer";
import { useFavoritesStore } from "../Toolbox/favoritesStore";
import { downloadTextFile, downloadBlob } from "../../core/io/fileIo";
import { buildExportSvg, exportDiagramAsPng } from "../../core/io/imageExport";
import { buildBpmnXml } from "../../modules/bpmn/io/bpmnXmlExport";

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
  };

  const handleExportBpmnXml = () => {
    downloadTextFile(buildBpmnXml(), timestampedName("diagramm", "bpmn"), "application/xml");
    setOpen(false);
  };

  const handleExportSvg = () => {
    downloadTextFile(buildExportSvg(), timestampedName("diagramm", "svg"), "image/svg+xml");
    setOpen(false);
  };

  const handleExportPng = async () => {
    setBusy(true);
    try {
      const blob = await exportDiagramAsPng(2);
      downloadBlob(blob, timestampedName("diagramm", "png"));
    } catch (err) {
      console.error(err);
      alert("PNG-Export fehlgeschlagen: " + (err instanceof Error ? err.message : "Unbekannter Fehler"));
    } finally {
      setBusy(false);
      setOpen(false);
    }
  };

  return (
    <div className="toolbar-menu" ref={menuRef}>
      <button onClick={() => setOpen((o) => !o)} disabled={busy}>
        {busy ? "Exportiere…" : "Export ▾"}
      </button>
      {open && (
        <div className="toolbar-menu-dropdown">
          <button onClick={handleExportSvg}>Als SVG (Vektor)</button>
          <button onClick={handleExportPng}>Als PNG (Bild)</button>
          <div className="toolbar-menu-divider" />
          <button onClick={handleExportBpmnXml}>Als BPMN 2.0 XML</button>
          <button onClick={handleExportJson}>Als JSON</button>
        </div>
      )}
    </div>
  );
}
