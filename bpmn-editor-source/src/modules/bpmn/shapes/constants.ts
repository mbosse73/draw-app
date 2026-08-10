// Standard-Größen für BPMN 2.0 Elemente, angelehnt an die üblichen
// Proportionen aus draw.io/Camunda Modeler für Wiedererkennbarkeit.

export const EVENT_SIZE = { width: 36, height: 36 };
export const TASK_SIZE = { width: 120, height: 80 };
export const GATEWAY_SIZE = { width: 50, height: 50 };
export const DATA_OBJECT_SIZE = { width: 40, height: 54 };

export const BPMN_COLORS = {
  stroke: "#454d5a",
  strokeSelected: "#3d5a99",
  fill: "#ffffff",
  taskFill: "#f8fafc",
  text: "#2f3540",
  icon: "#626b7a",
};

/** Ports für rechteckige Elemente (Tasks): 4 Seiten mittig. */
export const RECTANGLE_PORTS = [
  { id: "top", relativePosition: { x: 0.5, y: 0 } },
  { id: "right", relativePosition: { x: 1, y: 0.5 } },
  { id: "bottom", relativePosition: { x: 0.5, y: 1 } },
  { id: "left", relativePosition: { x: 0, y: 0.5 } },
];
