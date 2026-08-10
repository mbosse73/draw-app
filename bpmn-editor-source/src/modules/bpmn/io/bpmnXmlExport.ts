import { useCanvasStore } from "../../../core/state/canvasStore";
import type { ShapeInstance } from "../../../core/shapes/types";
import { getPortPosition } from "../../../core/canvas/connectorGeometry";
import { computeConnectorPath } from "../../../core/canvas/connectorPath";

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Mappt unseren internen connectorType auf das passende BPMN-XML-Element. */
function bpmnFlowTagFor(connectorType: string | undefined): string {
  if (connectorType === "bpmn.messageFlow") return "messageFlow";
  if (connectorType === "bpmn.association") return "association";
  return "sequenceFlow"; // Default, auch für generische/undefinierte Verbindungen
}

interface BpmnMapping {
  tag: string;
  /** Zusätzliches XML-Attribut für den Trigger, z.B. bei Timer/Message/Error-Events. */
  extraAttrs?: string;
}

/**
 * Mappt einen internen Shape-Typ auf sein BPMN-XML-Element. Muss bei jedem
 * neuen Shape-Typ im BPMN-Modul ergänzt werden, sonst fehlt das Element
 * komplett im XML-Export (kein Fallback möglich - im Gegensatz zum
 * Bild-Export gibt es in validem BPMN-XML kein generisches "Sonstiges"-Tag).
 */
function bpmnTagFor(shape: ShapeInstance): BpmnMapping | null {
  switch (shape.type) {
    case "bpmn.event.start":
    case "bpmn.event.start.timer":
    case "bpmn.event.start.message":
      return { tag: "startEvent" };
    case "bpmn.event.intermediate":
    case "bpmn.event.intermediate.timer":
    case "bpmn.event.intermediate.message":
      return { tag: "intermediateThrowEvent" };
    case "bpmn.event.end":
    case "bpmn.event.end.error":
    case "bpmn.event.end.message":
      return { tag: "endEvent" };
    case "bpmn.boundaryEvent.timer":
    case "bpmn.boundaryEvent.message":
    case "bpmn.boundaryEvent.error": {
      const interrupting = (shape.data.interrupting as boolean) ?? true;
      return { tag: "boundaryEvent", extraAttrs: ` cancelActivity="${interrupting}"` };
    }
    case "bpmn.task.none":
      // Generischer Task ohne festgelegten Typ - im BPMN-Standard das
      // einfache <task>-Element ohne Spezialisierung.
      return { tag: "task" };
    case "bpmn.task.user":
      return { tag: "userTask" };
    case "bpmn.task.service":
      return { tag: "serviceTask" };
    case "bpmn.task.manual":
      return { tag: "manualTask" };
    case "bpmn.subProcess":
      return { tag: "subProcess" };
    case "bpmn.gateway.exclusive":
      return { tag: "exclusiveGateway" };
    case "bpmn.gateway.parallel":
      return { tag: "parallelGateway" };
    case "bpmn.gateway.inclusive":
      return { tag: "inclusiveGateway" };
    case "bpmn.gateway.none":
      // BPMN kennt kein "Gateway ohne Typ" als eigenes Element - das
      // exklusive Gateway ohne Bedingungen kommt dem am nächsten und ist
      // die gängige Praxis anderer Tools für ein "einfaches" Gateway.
      return { tag: "exclusiveGateway" };
    case "bpmn.dataObject":
      return { tag: "dataObjectReference" };
    default:
      return null;
  }
}

function safeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, "_");
}

export function buildBpmnXml(): string {
  const state = useCanvasStore.getState();
  const shapes = Object.values(state.shapes);
  const connectors = Object.values(state.connectors);

  const pools = shapes.filter((s) => s.type === "bpmn.pool");
  const lanes = shapes.filter((s) => s.type === "bpmn.lane");
  const flowElements = shapes.filter((s) => bpmnTagFor(s) !== null);
  // Text-Elemente sind in BPMN kein Flow-Element mit incoming/outgoing,
  // sondern eine eigenständige textAnnotation - separat behandelt.
  const textShapes = shapes.filter((s) => s.type === "text.label");

  const processId = "Process_1";

  const textAnnotationXml = textShapes
    .map((shape) => {
      const text = (shape.data.label as string) ?? "";
      return `<bpmn:textAnnotation id="${safeId(shape.id)}"><bpmn:text>${escapeXml(text)}</bpmn:text></bpmn:textAnnotation>`;
    })
    .join("\n    ");

  const elementXml = flowElements
    .map((shape) => {
      const mapping = bpmnTagFor(shape);
      if (!mapping) return "";
      const name = (shape.data.label as string) ?? "";
      const nameAttr = name ? ` name="${escapeXml(name)}"` : "";
      const incoming = connectors.filter((c) => c.targetShapeId === shape.id);
      const outgoing = connectors.filter((c) => c.sourceShapeId === shape.id);
      const inXml = incoming.map((c) => `<bpmn:incoming>${safeId(c.id)}</bpmn:incoming>`).join("");
      const outXml = outgoing.map((c) => `<bpmn:outgoing>${safeId(c.id)}</bpmn:outgoing>`).join("");
      // Boundary Events brauchen zusätzlich attachedToRef, um dem BPMN-Standard
      // nach korrekt an ihre Host-Aktivität gebunden zu sein.
      const attachedAttr =
        mapping.tag === "boundaryEvent" && shape.attachedToId
          ? ` attachedToRef="${safeId(shape.attachedToId)}"`
          : "";
      return `<bpmn:${mapping.tag} id="${safeId(shape.id)}"${nameAttr}${mapping.extraAttrs ?? ""}${attachedAttr}>${inXml}${outXml}</bpmn:${mapping.tag}>`;
    })
    .join("\n    ");

  const flowXml = connectors
    .map((c) => {
      const label = c.label ? ` name="${escapeXml(c.label)}"` : "";
      const tag = bpmnFlowTagFor(c.connectorType);
      return `<bpmn:${tag} id="${safeId(c.id)}"${label} sourceRef="${safeId(c.sourceShapeId)}" targetRef="${safeId(c.targetShapeId)}" />`;
    })
    .join("\n    ");

  const laneSetXml = lanes
    .map((lane) => {
      const childIds = shapes.filter((s) => s.parentId === lane.id).map((s) => `<bpmn:flowNodeRef>${safeId(s.id)}</bpmn:flowNodeRef>`).join("");
      const name = (lane.data.label as string) ?? "";
      return `<bpmn:lane id="${safeId(lane.id)}" name="${escapeXml(name)}">${childIds}</bpmn:lane>`;
    })
    .join("\n      ");

  const processXml =
    pools.length > 0
      ? `<bpmn:process id="${processId}" isExecutable="false">
    ${lanes.length > 0 ? `<bpmn:laneSet>\n      ${laneSetXml}\n    </bpmn:laneSet>` : ""}
    ${elementXml}
    ${flowXml}
    ${textAnnotationXml}
  </bpmn:process>`
      : `<bpmn:process id="${processId}" isExecutable="false">
    ${elementXml}
    ${flowXml}
    ${textAnnotationXml}
  </bpmn:process>`;

  const shapeDiXml = shapes
    .map((shape) => {
      const isKnown =
        bpmnTagFor(shape) !== null ||
        shape.type === "bpmn.pool" ||
        shape.type === "bpmn.lane" ||
        shape.type === "text.label";
      if (!isKnown) return "";
      return `<bpmndi:BPMNShape id="${safeId(shape.id)}_di" bpmnElement="${safeId(shape.id)}">
        <dc:Bounds x="${shape.position.x}" y="${shape.position.y}" width="${shape.size.width}" height="${shape.size.height}" />
      </bpmndi:BPMNShape>`;
    })
    .join("\n      ");

  const edgeDiXml = connectors
    .map((c) => {
      const sourceShape = state.shapes[c.sourceShapeId];
      const targetShape = state.shapes[c.targetShapeId];
      if (!sourceShape || !targetShape) return "";
      const from = getPortPosition(sourceShape, c.sourcePortId);
      const to = getPortPosition(targetShape, c.targetPortId);
      if (!from || !to) return "";
      const excludeIds = new Set([c.sourceShapeId, c.targetShapeId]);
      const waypoints = computeConnectorPath(c, from, to, state.shapes, excludeIds, true);
      const waypointXml = waypoints.map((p) => `<di:waypoint x="${p.x}" y="${p.y}" />`).join("");
      return `<bpmndi:BPMNEdge id="${safeId(c.id)}_di" bpmnElement="${safeId(c.id)}">${waypointXml}</bpmndi:BPMNEdge>`;
    })
    .join("\n      ");

  return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
                  id="Definitions_1"
                  targetNamespace="http://bpmn.io/schema/bpmn">
  ${processXml}
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="${processId}">
      ${shapeDiXml}
      ${edgeDiXml}
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;
}
