import { useCanvasStore } from "../../../core/state/canvasStore";
import type { ShapeInstance, ConnectorInstance, ArrowHeadStyle } from "../../../core/shapes/types";

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Mehrzeilige Labels: jede Zeile einzeln escapen, Zeilenumbrüche als (escapetes) <br/> - style setzt html=1, damit draw.io das beim Öffnen wieder als echten Umbruch rendert. */
function escapeLabel(text: string): string {
  return text.split("\n").map(escapeXml).join("&lt;br&gt;");
}

function cellIdForShape(id: string): string {
  return "s_" + id.replace(/[^a-zA-Z0-9_-]/g, "_");
}
function cellIdForConnector(id: string): string {
  return "e_" + id.replace(/[^a-zA-Z0-9_-]/g, "_");
}

const CONTAINER_TYPES = new Set(["bpmn.pool", "bpmn.lane", "bpmn.subProcess"]);

/**
 * Stil-Strings bewusst auf die klassische, garantiert unterstützte mxGraph-
 * Grundform (ellipse/rhombus/rounded-rect/swimlane/note/text) beschränkt statt
 * auf draw.io's proprietäre BPMN-Stencils (mxgraph.bpmn.*) zu setzen: deren
 * genaue Symbol-Namen für Timer-/Nachricht-/Fehler-Marker ließen sich nicht
 * zuverlässig verifizieren, ein falscher Name würde beim Öffnen in draw.io zu
 * einer unsichtbaren/falschen Form statt nur einem fehlenden Icon führen.
 * Unterscheidung erfolgt stattdessen über Farbe/Randstärke/gestrichelt.
 */
function drawioStyleForShape(shape: ShapeInstance): string {
  const base = "html=1;whiteSpace=wrap;";
  switch (shape.type) {
    case "bpmn.event.start":
    case "bpmn.event.start.timer":
    case "bpmn.event.start.message":
      return `${base}ellipse;perimeter=ellipsePerimeter;verticalLabelPosition=bottom;verticalAlign=top;fillColor=#d5e8d4;strokeColor=#82b366;strokeWidth=2;`;
    case "bpmn.event.intermediate":
    case "bpmn.event.intermediate.timer":
    case "bpmn.event.intermediate.message":
      return `${base}ellipse;perimeter=ellipsePerimeter;verticalLabelPosition=bottom;verticalAlign=top;fillColor=#fff2cc;strokeColor=#d6b656;strokeWidth=2;`;
    case "bpmn.event.end":
    case "bpmn.event.end.error":
    case "bpmn.event.end.message":
      return `${base}ellipse;perimeter=ellipsePerimeter;verticalLabelPosition=bottom;verticalAlign=top;fillColor=#f8cecc;strokeColor=#b85450;strokeWidth=3;`;
    case "bpmn.boundaryEvent.timer":
    case "bpmn.boundaryEvent.message":
    case "bpmn.boundaryEvent.error": {
      const interrupting = (shape.data.interrupting as boolean) ?? true;
      return `${base}ellipse;perimeter=ellipsePerimeter;verticalLabelPosition=bottom;verticalAlign=top;fillColor=#fff2cc;strokeColor=#d6b656;strokeWidth=2;${interrupting ? "" : "dashed=1;"}`;
    }
    case "bpmn.task.none":
    case "bpmn.task.user":
    case "bpmn.task.service":
    case "bpmn.task.manual":
      return `${base}rounded=1;arcSize=12;fillColor=#dae8fc;strokeColor=#6c8ebf;`;
    case "bpmn.subProcess": {
      const expanded = (shape.data.expanded as boolean) ?? false;
      return `${base}rounded=1;arcSize=12;fillColor=${expanded ? "#ffffff" : "#dae8fc"};strokeColor=#6c8ebf;`;
    }
    case "bpmn.gateway.exclusive":
    case "bpmn.gateway.parallel":
    case "bpmn.gateway.inclusive":
    case "bpmn.gateway.none":
      return `${base}rhombus;fillColor=#fff2cc;strokeColor=#d6b656;`;
    case "bpmn.dataObject":
      return `${base}shape=note;size=14;fillColor=#ffffff;strokeColor=#454d5a;`;
    case "bpmn.pool":
      return `shape=pool;html=1;startSize=24;horizontal=0;fillColor=#ffffff;strokeColor=#454d5a;`;
    case "bpmn.lane":
      return `swimlane;html=1;startSize=24;horizontal=0;fillColor=none;strokeColor=#454d5a;`;
    case "text.label": {
      const showBorder = (shape.data.showBorder as boolean) ?? false;
      return showBorder
        ? `${base}rounded=0;fillColor=none;strokeColor=#454d5a;`
        : `text;html=1;align=left;verticalAlign=middle;`;
    }
    default:
      // Unbekannte/zukünftige Shape-Typen: generisches Rechteck statt sie
      // stillschweigend wegzulassen (analog zur Import-Fallback-Regel).
      return `${base}rounded=1;fillColor=#f5f5f5;strokeColor=#666666;`;
  }
}

const ARROW_STYLE: Record<ArrowHeadStyle, string> = { none: "none", arrow: "block", diamond: "diamond", circle: "oval" };

function drawioStyleForConnector(c: ConnectorInstance): string {
  const base = "html=1;edgeStyle=orthogonalEdgeStyle;rounded=0;";
  let lineStyle = c.style?.lineStyle;
  let endArrow = c.style?.endArrow;
  const startArrow = c.style?.startArrow;

  if (!lineStyle || !endArrow) {
    if (c.connectorType === "bpmn.messageFlow") {
      lineStyle ??= "dashed";
      endArrow ??= "arrow";
    } else if (c.connectorType === "bpmn.association") {
      lineStyle ??= "dotted";
      endArrow ??= "none";
    } else {
      lineStyle ??= "solid";
      endArrow ??= "arrow";
    }
  }

  const dashPart = lineStyle === "dashed" ? "dashed=1;" : lineStyle === "dotted" ? "dashed=1;dashPattern=1 2;" : "";
  const endArrowPart = `endArrow=${ARROW_STYLE[endArrow]};endFill=${endArrow === "arrow" ? "1" : "0"};`;
  const startArrowPart =
    startArrow && startArrow !== "none" ? `startArrow=${ARROW_STYLE[startArrow]};startFill=1;` : "startArrow=none;";

  return `${base}${dashPart}${endArrowPart}${startArrowPart}`;
}

/**
 * Baut ein einfaches, unkomprimiertes .drawio-XML (mxGraphModel) aus dem
 * aktuellen Diagramm. Bewusst KEINE echte mxCell-Eltern-Verschachtelung für
 * Pool/Lane/Sub-Prozess-Kinder (spart die sonst nötige Umrechnung auf
 * parent-relative Koordinaten, da unser eigenes Modell schon absolute
 * Weltkoordinaten je Shape führt - siehe containment.ts) - die visuelle
 * Verschachtelung ergibt sich stattdessen allein aus Position + Zeichenreihenfolge
 * (Container zuerst, damit Kinder optisch darüber liegen).
 */
export function buildDrawioXml(): string {
  const state = useCanvasStore.getState();
  const shapes = Object.values(state.shapes);
  const connectors = Object.values(state.connectors);

  const containers = shapes.filter((s) => CONTAINER_TYPES.has(s.type));
  const others = shapes.filter((s) => !CONTAINER_TYPES.has(s.type)).sort((a, b) => a.zIndex - b.zIndex);
  const orderedShapes = [...containers, ...others];

  const vertexXml = orderedShapes
    .map((shape) => {
      const label = escapeLabel((shape.data.label as string) ?? "");
      const style = drawioStyleForShape(shape);
      return `<mxCell id="${cellIdForShape(shape.id)}" value="${label}" style="${style}" vertex="1" parent="1">
          <mxGeometry x="${shape.position.x}" y="${shape.position.y}" width="${shape.size.width}" height="${shape.size.height}" as="geometry" />
        </mxCell>`;
    })
    .join("\n        ");

  const edgeXml = connectors
    .map((c) => {
      const sourceShape = state.shapes[c.sourceShapeId];
      const targetShape = state.shapes[c.targetShapeId];
      if (!sourceShape || !targetShape) return "";
      const labelAttr = c.label ? ` value="${escapeLabel(c.label)}"` : "";
      const style = drawioStyleForConnector(c);
      // Erster/letzter Wegpunkt entsprechen den Port-Ankerpunkten auf den
      // Shapes selbst - draw.io berechnet diese über source/target + perimeter
      // neu, nur die Zwischenpunkte müssen explizit mitgegeben werden.
      const interior = c.waypoints.length > 2 ? c.waypoints.slice(1, -1) : [];
      const pointsXml = interior.length
        ? `<Array as="points">${interior.map((p) => `<mxPoint x="${p.x}" y="${p.y}" />`).join("")}</Array>`
        : "";
      return `<mxCell id="${cellIdForConnector(c.id)}"${labelAttr} style="${style}" edge="1" parent="1" source="${cellIdForShape(c.sourceShapeId)}" target="${cellIdForShape(c.targetShapeId)}">
          <mxGeometry relative="1" as="geometry">${pointsXml}</mxGeometry>
        </mxCell>`;
    })
    .join("\n        ");

  return `<?xml version="1.0" encoding="UTF-8"?>
<mxfile host="bpmn-editor" version="1.0">
  <diagram id="diagram1" name="BPMN">
    <mxGraphModel dx="800" dy="600" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="850" pageHeight="1100" math="0" shadow="0">
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />
        ${vertexXml}
        ${edgeXml}
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`;
}
