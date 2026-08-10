import { useCanvasStore } from "../../core/state/canvasStore";
import { ConnectorTypeRegistry, DEFAULT_CONNECTOR_STYLE } from "../../core/shapes/ConnectorTypeRegistry";
import { ShapeRegistry } from "../../core/shapes/ShapeRegistry";

export function PropertiesPanel() {
  const selectedShapeIds = useCanvasStore((s) => s.selectedShapeIds);
  const selectedConnectorId = useCanvasStore((s) => s.selectedConnectorId);
  const shapes = useCanvasStore((s) => s.shapes);
  const connectors = useCanvasStore((s) => s.connectors);
  const updateShape = useCanvasStore((s) => s.updateShape);
  const resizeShape = useCanvasStore((s) => s.resizeShape);
  const setConnectorType = useCanvasStore((s) => s.setConnectorType);
  const setConnectorLabel = useCanvasStore((s) => s.setConnectorLabel);
  const removeManualWaypoint = useCanvasStore((s) => s.removeManualWaypoint);

  if (selectedConnectorId) {
    const connector = connectors[selectedConnectorId];
    if (!connector) return null;
    const availableTypes = ConnectorTypeRegistry.getAll();
    const currentType = connector.connectorType ?? availableTypes[0]?.type ?? DEFAULT_CONNECTOR_STYLE.type;
    const hasManualWaypoints = Boolean(connector.manualWaypoints && connector.manualWaypoints.length > 0);

    return (
      <div className="properties-panel">
        <h4>Verbindung</h4>
        <label className="properties-field">
          <span>Beschriftung</span>
          <input
            type="text"
            value={connector.label ?? ""}
            onChange={(e) => setConnectorLabel(connector.id, e.target.value)}
          />
        </label>
        {availableTypes.length > 0 && (
          <label className="properties-field">
            <span>Verbindungstyp</span>
            <select
              value={currentType}
              onChange={(e) => setConnectorType(connector.id, e.target.value)}
            >
              {availableTypes.map((t) => (
                <option key={t.type} value={t.type}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
        )}
        {hasManualWaypoints && (
          <div className="properties-field">
            <span>Verlauf</span>
            <p className="properties-hint">
              {connector.manualWaypoints!.length} manuelle Wegpunkt{connector.manualWaypoints!.length === 1 ? "" : "e"} gesetzt.
              Doppelklick auf einen Punkt entfernt ihn.
            </p>
            <button
              onClick={() => {
                const count = connector.manualWaypoints!.length;
                for (let i = 0; i < count; i++) {
                  removeManualWaypoint(connector.id, 0);
                }
              }}
            >
              Alle Wegpunkte entfernen (Auto-Routing)
            </button>
          </div>
        )}
      </div>
    );
  }

  if (selectedShapeIds.length === 0) {
    return (
      <div className="properties-panel properties-panel--empty">
        <p>Kein Element ausgewählt</p>
      </div>
    );
  }

  const shape = shapes[selectedShapeIds[0]];
  if (!shape) return null;

  const definition = ShapeRegistry.get(shape.type);
  const isAttached = Boolean(shape.attachedToId);
  const isCollapsible = Boolean(definition?.collapsedSize && definition?.expandedSize);
  const showSizeFields = !isAttached && !isCollapsible;
  const isBoundaryEvent = shape.type.startsWith("bpmn.boundaryEvent.");
  const isTextShape = shape.type === "text.label";

  return (
    <div className="properties-panel">
      <h4>Eigenschaften</h4>
      {selectedShapeIds.length > 1 && (
        <p className="properties-hint">{selectedShapeIds.length} Elemente ausgewählt</p>
      )}
      <label className="properties-field">
        <span>Beschriftung</span>
        <input
          type="text"
          value={(shape.data.label as string) ?? ""}
          onChange={(e) => updateShape(shape.id, { data: { ...shape.data, label: e.target.value } })}
        />
      </label>
      {isBoundaryEvent && (
        <label className="properties-field">
          <span>Verhalten</span>
          <select
            value={(shape.data.interrupting as boolean) ?? true ? "interrupting" : "non-interrupting"}
            onChange={(e) =>
              updateShape(shape.id, { data: { ...shape.data, interrupting: e.target.value === "interrupting" } })
            }
          >
            <option value="interrupting">Unterbrechend</option>
            <option value="non-interrupting">Nicht unterbrechend</option>
          </select>
        </label>
      )}
      {isTextShape && (
        <label className="properties-field properties-field--checkbox">
          <input
            type="checkbox"
            checked={(shape.data.showBorder as boolean) ?? false}
            onChange={(e) => updateShape(shape.id, { data: { ...shape.data, showBorder: e.target.checked } })}
          />
          <span>Rahmen anzeigen</span>
        </label>
      )}
      {isAttached && (
        <p className="properties-hint">Größe und Position folgen dem angehefteten Element.</p>
      )}
      {isCollapsible && (
        <p className="properties-hint">Größe wird über das Auf-/Zuklapp-Symbol auf dem Element gesteuert.</p>
      )}
      {showSizeFields && (
        <>
          <label className="properties-field">
            <span>Breite</span>
            <input
              type="number"
              value={shape.size.width}
              onChange={(e) => resizeShape(shape.id, { ...shape.size, width: Number(e.target.value) })}
            />
          </label>
          <label className="properties-field">
            <span>Höhe</span>
            <input
              type="number"
              value={shape.size.height}
              onChange={(e) => resizeShape(shape.id, { ...shape.size, height: Number(e.target.value) })}
            />
          </label>
        </>
      )}
    </div>
  );
}
