import { useCanvasStore } from "../../core/state/canvasStore";
import { ConnectorTypeRegistry, DEFAULT_CONNECTOR_STYLE } from "../../core/shapes/ConnectorTypeRegistry";
import { ShapeRegistry } from "../../core/shapes/ShapeRegistry";
import { resolveConnectorArrowStyle, resolveConnectorLineStyle } from "../../core/canvas/connectorStyle";
import type { ArrowHeadStyle, ConnectorLineStyle, ConnectorPathStyle } from "../../core/shapes/types";

const LINE_STYLE_LABELS: Record<ConnectorLineStyle, string> = {
  solid: "Durchgezogen",
  dashed: "Gestrichelt",
  dotted: "Gepunktet",
};

const ARROW_STYLE_LABELS: Record<ArrowHeadStyle, string> = {
  none: "Keine",
  arrow: "Pfeil",
  diamond: "Raute",
  circle: "Kreis",
};

const PATH_STYLE_LABELS: Record<ConnectorPathStyle, string> = {
  orthogonal: "Orthogonal",
  straight: "Gerade",
  curved: "Kurvig (Bezier)",
  stepped: "Entity-Relation-Knick",
};

/** Wireframe-Shapes, deren Inhalt aus mehreren Zeilen besteht (data.items,
 *  zeilenweise getrennt - siehe modules/wireframe/shapes/sketch.ts parseItems). */
const ITEMS_FIELD_TYPES = new Set([
  "wireframe.list",
  "wireframe.table",
  "wireframe.tree",
  "wireframe.menuBar",
  "wireframe.dropdownMenu",
  "wireframe.tabContainer",
  "wireframe.segmentedControl",
  "wireframe.accordion",
  "wireframe.breadcrumb",
]);

export function PropertiesPanel() {
  const selectedShapeIds = useCanvasStore((s) => s.selectedShapeIds);
  const selectedConnectorId = useCanvasStore((s) => s.selectedConnectorId);
  const shapes = useCanvasStore((s) => s.shapes);
  const connectors = useCanvasStore((s) => s.connectors);
  const updateShape = useCanvasStore((s) => s.updateShape);
  const resizeShape = useCanvasStore((s) => s.resizeShape);
  const setShapeRotation = useCanvasStore((s) => s.setShapeRotation);
  const setConnectorType = useCanvasStore((s) => s.setConnectorType);
  const setConnectorLabel = useCanvasStore((s) => s.setConnectorLabel);
  const updateConnectorStyle = useCanvasStore((s) => s.updateConnectorStyle);
  const removeManualWaypoint = useCanvasStore((s) => s.removeManualWaypoint);

  if (selectedConnectorId) {
    const connector = connectors[selectedConnectorId];
    if (!connector) return null;
    const availableTypes = ConnectorTypeRegistry.getAll();
    const currentType = connector.connectorType ?? availableTypes[0]?.type ?? DEFAULT_CONNECTOR_STYLE.type;
    const typeDef = ConnectorTypeRegistry.get(connector.connectorType) ?? DEFAULT_CONNECTOR_STYLE;
    const effectiveLineStyle = resolveConnectorLineStyle(connector, typeDef);
    const effectiveArrows = resolveConnectorArrowStyle(connector, typeDef);
    const hasManualWaypoints = Boolean(connector.manualWaypoints && connector.manualWaypoints.length > 0);

    return (
      <div className="properties-panel">
        <h4>Verbindung</h4>
        <label className="properties-field">
          <span>Beschriftung</span>
          <textarea
            rows={Math.max(2, (connector.label ?? "").split("\n").length)}
            value={connector.label ?? ""}
            onChange={(e) => setConnectorLabel(connector.id, e.target.value)}
          />
        </label>

        {availableTypes.length > 0 && (
          <label className="properties-field">
            <span>Verbindungstyp</span>
            <select value={currentType} onChange={(e) => setConnectorType(connector.id, e.target.value)}>
              {availableTypes.map((t) => (
                <option key={t.type} value={t.type}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
        )}

        <h4>↝ Verlauf & Linie</h4>
        <div className="properties-row">
          <label className="properties-field">
            <span>Pfad-Stil</span>
            <select
              value={connector.style?.pathStyle ?? "orthogonal"}
              onChange={(e) => updateConnectorStyle(connector.id, { pathStyle: e.target.value as ConnectorPathStyle })}
            >
              {(Object.keys(PATH_STYLE_LABELS) as ConnectorPathStyle[]).map((style) => (
                <option key={style} value={style}>
                  {PATH_STYLE_LABELS[style]}
                </option>
              ))}
            </select>
          </label>
          <label className="properties-field">
            <span>Linienstil</span>
            <select
              value={effectiveLineStyle}
              onChange={(e) => updateConnectorStyle(connector.id, { lineStyle: e.target.value as ConnectorLineStyle })}
            >
              {(Object.keys(LINE_STYLE_LABELS) as ConnectorLineStyle[]).map((style) => (
                <option key={style} value={style}>
                  {LINE_STYLE_LABELS[style]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="properties-row">
          <label className="properties-field">
            <span>Pfeil Anfang</span>
            <select
              value={effectiveArrows.start}
              onChange={(e) => updateConnectorStyle(connector.id, { startArrow: e.target.value as ArrowHeadStyle })}
            >
              {(Object.keys(ARROW_STYLE_LABELS) as ArrowHeadStyle[]).map((style) => (
                <option key={style} value={style}>
                  {ARROW_STYLE_LABELS[style]}
                </option>
              ))}
            </select>
          </label>
          <label className="properties-field">
            <span>Pfeil Ende</span>
            <select
              value={effectiveArrows.end}
              onChange={(e) => updateConnectorStyle(connector.id, { endArrow: e.target.value as ArrowHeadStyle })}
            >
              {(Object.keys(ARROW_STYLE_LABELS) as ArrowHeadStyle[]).map((style) => (
                <option key={style} value={style}>
                  {ARROW_STYLE_LABELS[style]}
                </option>
              ))}
            </select>
          </label>
        </div>

        {hasManualWaypoints && (
          <div className="properties-field">
            <span>Verlauf (manuell)</span>
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
  const canRotate = !isAttached && !definition?.isContainer;
  const hasItemsField = ITEMS_FIELD_TYPES.has(shape.type);
  const hasColumnsField = shape.type === "wireframe.table";

  const opacityPercent = Math.round((shape.style?.opacity ?? 1) * 100);

  return (
    <div className="properties-panel">
      <h4>Eigenschaften</h4>
      {selectedShapeIds.length > 1 && (
        <p className="properties-hint">{selectedShapeIds.length} Elemente ausgewählt</p>
      )}
      <label className="properties-field">
        <span>Beschriftung</span>
        <textarea
          rows={Math.max(2, ((shape.data.label as string) ?? "").split("\n").length)}
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
      {hasColumnsField && (
        <label className="properties-field">
          <span>Spalten (eine pro Zeile)</span>
          <textarea
            rows={3}
            value={(shape.data.columns as string) ?? ""}
            onChange={(e) => updateShape(shape.id, { data: { ...shape.data, columns: e.target.value } })}
          />
        </label>
      )}
      {hasItemsField && (
        <label className="properties-field">
          <span>Zeilen (eine pro Zeile)</span>
          <textarea
            rows={4}
            value={(shape.data.items as string) ?? ""}
            onChange={(e) => updateShape(shape.id, { data: { ...shape.data, items: e.target.value } })}
          />
        </label>
      )}

      {(showSizeFields || canRotate) && <h4>▦ Geometrie</h4>}
      {isAttached && <p className="properties-hint">Größe und Position folgen dem angehefteten Element.</p>}
      {isCollapsible && (
        <p className="properties-hint">Größe wird über das Auf-/Zuklapp-Symbol auf dem Element gesteuert.</p>
      )}
      {(showSizeFields || canRotate) && (
        <div className="properties-row">
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
          {canRotate && (
            <label className="properties-field">
              <span>Rotation °</span>
              <input
                type="number"
                value={Math.round(shape.style?.rotation ?? 0)}
                onChange={(e) => setShapeRotation(shape.id, Number(e.target.value))}
              />
            </label>
          )}
        </div>
      )}

      {/* Generisches Stil-Panel (Z-15), unabhängig von BPMN-Fachfeldern -
          siehe ShapeStyle in core/shapes/types.ts. Fill-/Stroke-/Breite-/
          Strichart-Overrides werden aktuell nur von den BPMN-Modul-Shapes
          selbst konsumiert (siehe modules/bpmn/shapes/constants.ts
          resolveFill/resolveStroke/...) - Opacity und Schatten wirken
          hingegen für JEDEN Shape-Typ, da CanvasEngine.tsx sie generisch am
          Shape-Wrapper anwendet. Kompakt zu zweit pro Zeile (properties-row)
          statt gestapelt, damit das Panel ohne Scrollen auskommt. */}
      <h4>🎨 Stil</h4>
      <div className="properties-row">
        <label className="properties-field properties-field--color">
          <span>Füllfarbe</span>
          <input
            type="color"
            value={shape.style?.fillColor ?? "#ffffff"}
            onChange={(e) => updateShape(shape.id, { style: { ...shape.style, fillColor: e.target.value } })}
          />
        </label>
        <label className="properties-field properties-field--color">
          <span>Linie</span>
          <input
            type="color"
            value={shape.style?.strokeColor ?? "#454d5a"}
            onChange={(e) => updateShape(shape.id, { style: { ...shape.style, strokeColor: e.target.value } })}
          />
        </label>
      </div>
      <div className="properties-row">
        <label className="properties-field">
          <span>Linienstärke</span>
          <input
            type="number"
            min={0.5}
            step={0.5}
            value={shape.style?.strokeWidth ?? 1.5}
            onChange={(e) => updateShape(shape.id, { style: { ...shape.style, strokeWidth: Number(e.target.value) } })}
          />
        </label>
        <label className="properties-field">
          <span>Linienart</span>
          <select
            value={shape.style?.dashStyle ?? "solid"}
            onChange={(e) =>
              updateShape(shape.id, { style: { ...shape.style, dashStyle: e.target.value as "solid" | "dashed" | "dotted" } })
            }
          >
            <option value="solid">Durchgezogen</option>
            <option value="dashed">Gestrichelt</option>
            <option value="dotted">Gepunktet</option>
          </select>
        </label>
      </div>
      <label className="properties-field properties-field--range">
        <span>Transparenz</span>
        <div className="properties-range-row">
          <input
            type="range"
            min={0.1}
            max={1}
            step={0.05}
            value={shape.style?.opacity ?? 1}
            onChange={(e) => updateShape(shape.id, { style: { ...shape.style, opacity: Number(e.target.value) } })}
          />
          <span className="properties-range-value">{opacityPercent}%</span>
        </div>
      </label>
      <div className="properties-inline-actions">
        <label className="properties-field properties-field--checkbox">
          <input
            type="checkbox"
            checked={shape.style?.shadow ?? false}
            onChange={(e) => updateShape(shape.id, { style: { ...shape.style, shadow: e.target.checked } })}
          />
          <span>Schatten</span>
        </label>
        <button
          className="properties-reset-link"
          onClick={() =>
            updateShape(shape.id, { style: { rotation: shape.style?.rotation, flipX: shape.style?.flipX, flipY: shape.style?.flipY } })
          }
        >
          Stil zurücksetzen
        </button>
      </div>
    </div>
  );
}
