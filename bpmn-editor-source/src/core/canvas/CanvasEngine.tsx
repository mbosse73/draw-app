import { useRef, useState, useCallback, useEffect, useMemo, type WheelEvent, type MouseEvent } from "react";
import { useCanvasStore } from "../state/canvasStore";
import type { ShapeInstance } from "../shapes/types";
import { GridLayer } from "./GridLayer";
import { ShapeRegistry } from "../shapes/ShapeRegistry";
import { ShapePorts } from "./ShapePorts";
import { ConnectorLayer } from "./ConnectorLayer";
import { findPortNear } from "./connectorGeometry";
import { findContainerAt, isAncestor } from "./containment";
import { ResizeHandle } from "./ResizeHandle";
import { copySelectionToClipboard, pasteClipboard } from "../state/clipboard";
import { computeAlignmentGuides, type AlignmentGuide } from "./alignmentGuides";
import { AlignmentGuidesLayer } from "./AlignmentGuidesLayer";
import { pushHistorySnapshot, undo, redo } from "../state/history";
import { ratioForPointOnRect, getAttachedPosition } from "./attachmentGeometry";

/**
 * Core-Engine-Komponente: kennt keine BPMN-Spezifika.
 * Zuständig für Zoom, Pan, Grid-Rendering und das Platzieren generischer Shapes.
 */
export function CanvasEngine() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const viewport = useCanvasStore((s) => s.viewport);
  const shapes = useCanvasStore((s) => s.shapes);
  const connectors = useCanvasStore((s) => s.connectors);
  const gridSize = useCanvasStore((s) => s.gridSize);
  const selectedShapeIds = useCanvasStore((s) => s.selectedShapeIds);
  const selectedConnectorId = useCanvasStore((s) => s.selectedConnectorId);
  const hoveredShapeId = useCanvasStore((s) => s.hoveredShapeId);
  const connectorDraft = useCanvasStore((s) => s.connectorDraft);
  const selectionRect = useCanvasStore((s) => s.selectionRect);
  const zoomAt = useCanvasStore((s) => s.zoomAt);
  const pan = useCanvasStore((s) => s.pan);
  const moveShape = useCanvasStore((s) => s.moveShape);
  const moveShapesBy = useCanvasStore((s) => s.moveShapesBy);
  const selectShape = useCanvasStore((s) => s.selectShape);
  const selectShapes = useCanvasStore((s) => s.selectShapes);
  const selectConnector = useCanvasStore((s) => s.selectConnector);
  const addShape = useCanvasStore((s) => s.addShape);
  const setHoveredShape = useCanvasStore((s) => s.setHoveredShape);
  const startConnectorDraft = useCanvasStore((s) => s.startConnectorDraft);
  const updateConnectorDraft = useCanvasStore((s) => s.updateConnectorDraft);
  const cancelConnectorDraft = useCanvasStore((s) => s.cancelConnectorDraft);
  const addConnector = useCanvasStore((s) => s.addConnector);
  const resizeShape = useCanvasStore((s) => s.resizeShape);
  const setShapeParent = useCanvasStore((s) => s.setShapeParent);
  const groupShapes = useCanvasStore((s) => s.groupShapes);
  const ungroupShapes = useCanvasStore((s) => s.ungroupShapes);
  const getGroupMemberIds = useCanvasStore((s) => s.getGroupMemberIds);
  const reconnectDraft = useCanvasStore((s) => s.reconnectDraft);
  const startReconnectDraft = useCanvasStore((s) => s.startReconnectDraft);
  const updateReconnectDraft = useCanvasStore((s) => s.updateReconnectDraft);
  const cancelReconnectDraft = useCanvasStore((s) => s.cancelReconnectDraft);
  const setConnectorEndpoint = useCanvasStore((s) => s.setConnectorEndpoint);
  const insertManualWaypoint = useCanvasStore((s) => s.insertManualWaypoint);
  const moveManualWaypoint = useCanvasStore((s) => s.moveManualWaypoint);
  const removeManualWaypoint = useCanvasStore((s) => s.removeManualWaypoint);
  const startSelectionRect = useCanvasStore((s) => s.startSelectionRect);
  const updateSelectionRect = useCanvasStore((s) => s.updateSelectionRect);
  const endSelectionRect = useCanvasStore((s) => s.endSelectionRect);

  // Ist gerade eine neue Verbindung im Aufbau?
  const isDraggingConnector = useRef(false);
  // Wird gerade ein bestehender Verbindungs-Endpunkt gelöst und neu gezogen?
  const isReconnecting = useRef(false);

  // Pan-State (mittlere Maustaste oder Space+Linksklick)
  const [isPanning, setIsPanning] = useState(false);
  const [isSpaceDown, setIsSpaceDown] = useState(false);
  const panStart = useRef<{ x: number; y: number } | null>(null);

  // Drag-State für Shapes. Bei Mehrfachauswahl enthält dragGroupIds alle
  // mitzuziehenden IDs, dragAnchorId ist die Shape unter dem Mauszeiger
  // (bestimmt Snapping/Alignment), dragStartPositions das Ausgangslayout
  // für eine deltabasierte Verschiebung der ganzen Gruppe.
  const draggingShapeId = useRef<string | null>(null);
  const dragOffset = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragGroupIds = useRef<string[]>([]);
  const dragStartPositions = useRef<Record<string, { x: number; y: number }>>({});
  const didDrag = useRef(false);

  // Auswahlrechteck (Rubber-Band-Selection)
  const isSelecting = useRef(false);
  const selectionStartWasAdditive = useRef(false);

  // Drag-State für manuelle Verbindungs-Wegpunkte
  const draggingWaypoint = useRef<{ connectorId: string; index: number } | null>(null);

  // Während des Verschiebens vieler Elemente gleichzeitig (Gruppen-Drag) wird
  // das teure A*-Routing kurzzeitig übersprungen, damit die App flüssig bleibt.
  const [isBulkDragging, setIsBulkDragging] = useState(false);

  // Resize-State für Elemente
  const resizingShapeId = useRef<string | null>(null);
  const resizeStart = useRef<{ mouseX: number; mouseY: number; width: number; height: number; aspectRatio: number }>({
    mouseX: 0,
    mouseY: 0,
    width: 0,
    height: 0,
    aspectRatio: 1,
  });
  const didResize = useRef(false);

  // Ausrichtungs-Hilfslinien
  const [alignmentGuides, setAlignmentGuides] = useState<AlignmentGuide[]>([]);

  // --- Text-Editing (Doppelklick auf Shape oder Verbindung) ---
  const [editingShapeId, setEditingShapeId] = useState<string | null>(null);
  const [editingConnectorId, setEditingConnectorId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const updateShape = useCanvasStore((s) => s.updateShape);

  const handleShapeDoubleClick = useCallback(
    (e: MouseEvent, shapeId: string) => {
      e.stopPropagation();
      const shape = shapes[shapeId];
      if (!shape) return;
      setEditingConnectorId(null);
      setEditingShapeId(shapeId);
      setEditingValue((shape.data.label as string) ?? "");
    },
    [shapes]
  );

  const handleConnectorDoubleClick = useCallback(
    (connectorId: string) => {
      const connector = connectors[connectorId];
      if (!connector) return;
      setEditingShapeId(null);
      setEditingConnectorId(connectorId);
      setEditingValue(connector.label ?? "");
    },
    [connectors]
  );

  const commitEditing = useCallback(() => {
    if (editingShapeId) {
      const shape = shapes[editingShapeId];
      if (shape) {
        updateShape(editingShapeId, { data: { ...shape.data, label: editingValue } });
        pushHistorySnapshot();
      }
    }
    if (editingConnectorId) {
      useCanvasStore.getState().setConnectorLabel(editingConnectorId, editingValue);
      pushHistorySnapshot();
    }
    setEditingShapeId(null);
    setEditingConnectorId(null);
  }, [editingShapeId, editingConnectorId, editingValue, shapes, updateShape]);

  // --- Tastenkürzel: Pan, Löschen, Kopieren/Einfügen, Undo/Redo, Escape ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") setIsSpaceDown(true);

      const target = e.target as HTMLElement;
      const isTypingContext = target.tagName === "INPUT" || target.tagName === "TEXTAREA";

      if ((e.code === "Delete" || e.code === "Backspace") && !isTypingContext) {
        const state = useCanvasStore.getState();
        if (state.selectedShapeIds.length > 0 || state.selectedConnectorId) {
          state.selectedShapeIds.forEach((id) => state.removeShape(id));
          if (state.selectedConnectorId) state.removeConnector(state.selectedConnectorId);
          pushHistorySnapshot();
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.code === "KeyC" && !isTypingContext) {
        copySelectionToClipboard();
      }
      if ((e.ctrlKey || e.metaKey) && e.code === "KeyV" && !isTypingContext) {
        e.preventDefault();
        pasteClipboard();
        pushHistorySnapshot();
      }
      // e.key statt e.code, weil e.code die PHYSISCHE US-Tastenposition meint:
      // auf QWERTZ-Tastaturen (z.B. Deutsch) liegen Y und Z vertauscht, sodass
      // "KeyZ" dort tatsächlich Y auslösen würde. e.key liefert das layoutkorrekte Zeichen.
      const key = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && key === "z" && !isTypingContext) {
        e.preventDefault();
        undo();
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        (key === "y" || (e.shiftKey && key === "z")) &&
        !isTypingContext
      ) {
        e.preventDefault();
        redo();
      }
      if ((e.ctrlKey || e.metaKey) && e.code === "KeyA" && !isTypingContext) {
        e.preventDefault();
        selectShapes(Object.keys(useCanvasStore.getState().shapes));
      }

      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.code === "KeyG" && !isTypingContext) {
        e.preventDefault();
        const state = useCanvasStore.getState();
        if (state.selectedShapeIds.length >= 2) {
          groupShapes(state.selectedShapeIds);
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === "KeyG" && !isTypingContext) {
        e.preventDefault();
        const state = useCanvasStore.getState();
        if (state.selectedShapeIds.length > 0) {
          ungroupShapes(state.selectedShapeIds);
        }
      }

      // Pfeiltasten: selektierte Elemente pixelweise verschieben.
      // Shift = größerer Schritt (eine Gridzelle statt 1px), praktisch für
      // schnelles grobes Ausrichten ohne die Maus zu benutzen.
      const arrowDeltas: Record<string, { x: number; y: number }> = {
        ArrowUp: { x: 0, y: -1 },
        ArrowDown: { x: 0, y: 1 },
        ArrowLeft: { x: -1, y: 0 },
        ArrowRight: { x: 1, y: 0 },
      };
      if (arrowDeltas[e.code] && !isTypingContext) {
        const state = useCanvasStore.getState();
        if (state.selectedShapeIds.length > 0) {
          e.preventDefault();
          const step = e.shiftKey ? state.gridSize : 1;
          const delta = { x: arrowDeltas[e.code].x * step, y: arrowDeltas[e.code].y * step };
          moveShapesBy(state.selectedShapeIds, delta);
        }
      }

      if (e.code === "Escape") {
        cancelConnectorDraft();
        isDraggingConnector.current = false;
        cancelReconnectDraft();
        isReconnecting.current = false;
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") setIsSpaceDown(false);
    };
    window.addEventListener("keydown", handleKeyDown, { capture: true });
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [cancelConnectorDraft, cancelReconnectDraft, selectShapes, groupShapes, ungroupShapes, moveShapesBy]);

  // --- Zoom via Mausrad ---
  const handleWheel = useCallback(
    (e: WheelEvent<SVGSVGElement>) => {
      e.preventDefault();
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      zoomAt(screenX, screenY, e.deltaY);
    },
    [zoomAt]
  );

  // --- Pan starten (mittlere Maustaste, Space+Linksklick, ODER einfacher
  //     Linksklick auf leere Fläche). Shift+Linksklick auf leere Fläche
  //     startet stattdessen das Auswahlrechteck (additiv zur Selektion). ---
  const handleMouseDown = useCallback(
    (e: MouseEvent<SVGSVGElement>) => {
      const isMiddleButton = e.button === 1;
      const isSpaceLeftClick = e.button === 0 && isSpaceDown;
      if (isMiddleButton || isSpaceLeftClick) {
        e.preventDefault();
        setIsPanning(true);
        panStart.current = { x: e.clientX, y: e.clientY };
        return;
      }
      if (e.button === 0) {
        // Shapes, Connectors, Ports und Resize-Handles rufen alle
        // e.stopPropagation() auf - kommt ein Klick hier am <svg> überhaupt
        // an, war es zwangsläufig ein Klick auf leere Fläche (Hintergrund
        // oder das Grid-<rect>, welches die komplette Fläche überdeckt und
        // deshalb nicht per "e.target === svgRef.current" erkennbar ist).
        if (e.shiftKey) {
          // Shift+Klick auf leere Fläche: Auswahlrechteck, additiv zur Selektion.
          const rect = svgRef.current?.getBoundingClientRect();
          if (!rect) return;
          const worldX = (e.clientX - rect.left - viewport.x) / viewport.zoom;
          const worldY = (e.clientY - rect.top - viewport.y) / viewport.zoom;
          selectionStartWasAdditive.current = true;
          isSelecting.current = true;
          startSelectionRect(worldX, worldY);
        } else {
          // Einfacher Linksklick auf leere Fläche: Selektion aufheben und
          // die Zeichenfläche direkt verschieben (vertraute Standard-Geste
          // aus draw.io/Figma/Miro).
          selectShape(null);
          setIsPanning(true);
          panStart.current = { x: e.clientX, y: e.clientY };
        }
      }
    },
    [isSpaceDown, selectShape, viewport, startSelectionRect]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent<SVGSVGElement>) => {
      if (isPanning && panStart.current) {
        const dx = e.clientX - panStart.current.x;
        const dy = e.clientY - panStart.current.y;
        pan(dx, dy);
        panStart.current = { x: e.clientX, y: e.clientY };
        return;
      }
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const worldX = (e.clientX - rect.left - viewport.x) / viewport.zoom;
      const worldY = (e.clientY - rect.top - viewport.y) / viewport.zoom;

      if (isSelecting.current) {
        updateSelectionRect(worldX, worldY);
        return;
      }

      if (draggingWaypoint.current) {
        moveManualWaypoint(draggingWaypoint.current.connectorId, draggingWaypoint.current.index, {
          x: worldX,
          y: worldY,
        });
        return;
      }

      if (isDraggingConnector.current) {
        updateConnectorDraft({ x: worldX, y: worldY });
        return;
      }
      if (isReconnecting.current) {
        updateReconnectDraft({ x: worldX, y: worldY });
        return;
      }
      if (resizingShapeId.current) {
        didResize.current = true;
        const dx = (e.clientX - resizeStart.current.mouseX) / viewport.zoom;
        const dy = (e.clientY - resizeStart.current.mouseY) / viewport.zoom;
        const MIN_SIZE = 24;

        let newWidth = Math.max(MIN_SIZE, resizeStart.current.width + dx);
        let newHeight = Math.max(MIN_SIZE, resizeStart.current.height + dy);

        if (e.shiftKey) {
          const { aspectRatio } = resizeStart.current;
          if (Math.abs(dx) >= Math.abs(dy)) {
            newHeight = Math.max(MIN_SIZE, newWidth / aspectRatio);
            newWidth = newHeight * aspectRatio;
          } else {
            newWidth = Math.max(MIN_SIZE, newHeight * aspectRatio);
            newHeight = newWidth / aspectRatio;
          }
        }

        resizeShape(resizingShapeId.current, { width: newWidth, height: newHeight });
        return;
      }
      if (draggingShapeId.current) {
        didDrag.current = true;
        const shapeId = draggingShapeId.current;
        const shape = shapes[shapeId];
        if (!shape) return;

        // Angeheftete Shapes (z.B. Boundary Events) gleiten am Rand ihres
        // Hosts entlang, statt sich frei zu bewegen - die Maus bestimmt nur,
        // an welcher Stelle des Randes sie "einrasten".
        if (shape.attachedToId) {
          const host = shapes[shape.attachedToId];
          if (host) {
            const ratio = ratioForPointOnRect({ x: worldX, y: worldY }, host.position, host.size);
            updateShape(shapeId, { attachmentRatio: ratio, position: getAttachedPosition({ ...shape, attachmentRatio: ratio }, host) });
          }
          return;
        }

        const rawPosition = { x: worldX - dragOffset.current.x, y: worldY - dragOffset.current.y };
        const { guides, snappedPosition } = computeAlignmentGuides(shapeId, rawPosition, shape.size, shapes);
        setAlignmentGuides(guides);

        if (dragGroupIds.current.length > 1) {
          // Mehrfachauswahl: Delta relativ zur Anker-Shape auf alle anderen
          // ausgewählten Elemente übertragen, damit die Gruppe als Ganzes
          // mitwandert statt nur das angeklickte Element.
          if (!isBulkDragging) setIsBulkDragging(true);
          const anchorStart = dragStartPositions.current[shapeId];
          if (anchorStart) {
            moveShapesBy(dragGroupIds.current, {
              x: snappedPosition.x - shape.position.x,
              y: snappedPosition.y - shape.position.y,
            });
          }
        } else {
          const hasAlignmentSnap = guides.length > 0;
          moveShape(shapeId, snappedPosition, hasAlignmentSnap);
        }
      }
    },
    [
      isPanning,
      pan,
      moveShape,
      moveShapesBy,
      moveManualWaypoint,
      viewport,
      updateConnectorDraft,
      resizeShape,
      updateReconnectDraft,
      shapes,
      updateSelectionRect,
      isBulkDragging,
      updateShape,
    ]
  );

  const handleMouseUp = useCallback(
    (e: MouseEvent<SVGSVGElement>) => {
      if (draggingWaypoint.current) {
        draggingWaypoint.current = null;
        pushHistorySnapshot();
      }

      if (isSelecting.current) {
        isSelecting.current = false;
        const rect = useCanvasStore.getState().selectionRect;
        if (rect) {
          const minX = Math.min(rect.startX, rect.currentX);
          const maxX = Math.max(rect.startX, rect.currentX);
          const minY = Math.min(rect.startY, rect.currentY);
          const maxY = Math.max(rect.startY, rect.currentY);
          // Nur eine nennenswerte Ziehbewegung als Rahmen werten, ein reiner
          // Klick auf leere Fläche soll nicht "0x0-Rahmen" als Treffer zählen.
          if (maxX - minX > 3 || maxY - minY > 3) {
            const hits = Object.values(shapes).filter((s) => {
              const shapeMaxX = s.position.x + s.size.width;
              const shapeMaxY = s.position.y + s.size.height;
              // Vollständige Überlappung mit dem Rahmen (klassisches Verhalten
              // von draw.io/Lucidchart: Element muss komplett im Rahmen liegen).
              return s.position.x >= minX && shapeMaxX <= maxX && s.position.y >= minY && shapeMaxY <= maxY;
            });
            const hitIds = hits.map((s) => s.id);
            if (selectionStartWasAdditive.current) {
              const current = useCanvasStore.getState().selectedShapeIds;
              const merged = Array.from(new Set([...current, ...hitIds]));
              selectShapes(merged);
            } else {
              selectShapes(hitIds);
            }
          }
        }
        endSelectionRect();
      }

      if (isDraggingConnector.current) {
        const draft = useCanvasStore.getState().connectorDraft;
        isDraggingConnector.current = false;
        if (draft) {
          const rect = svgRef.current?.getBoundingClientRect();
          if (rect) {
            const worldX = (e.clientX - rect.left - viewport.x) / viewport.zoom;
            const worldY = (e.clientY - rect.top - viewport.y) / viewport.zoom;
            const target = findPortNear(shapes, { x: worldX, y: worldY }, 25 / viewport.zoom);
            if (target && target.shapeId !== draft.sourceShapeId) {
              addConnector({
                id: `conn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                sourceShapeId: draft.sourceShapeId,
                sourcePortId: draft.sourcePortId,
                targetShapeId: target.shapeId,
                targetPortId: target.portId,
                waypoints: [],
              });
              pushHistorySnapshot();
            }
          }
        }
        cancelConnectorDraft();
      }

      if (isReconnecting.current) {
        const draft = useCanvasStore.getState().reconnectDraft;
        isReconnecting.current = false;
        if (draft) {
          const rect = svgRef.current?.getBoundingClientRect();
          if (rect) {
            const worldX = (e.clientX - rect.left - viewport.x) / viewport.zoom;
            const worldY = (e.clientY - rect.top - viewport.y) / viewport.zoom;
            const target = findPortNear(shapes, { x: worldX, y: worldY }, 25 / viewport.zoom);
            const connector = useCanvasStore.getState().connectors[draft.connectorId];
            const otherEndShapeId =
              connector && draft.end === "source" ? connector.targetShapeId : connector?.sourceShapeId;
            if (target && target.shapeId !== otherEndShapeId) {
              setConnectorEndpoint(draft.connectorId, draft.end, target.shapeId, target.portId);
              pushHistorySnapshot();
            }
          }
        }
        cancelReconnectDraft();
      }

      if (resizingShapeId.current) {
        resizingShapeId.current = null;
        if (didResize.current) pushHistorySnapshot();
        didResize.current = false;
      }

      // Nach dem Verschieben: Containment (Lane/Pool-Zuordnung) für jede
      // bewegte Shape einzeln neu bewerten - auch bei Mehrfachauswahl.
      // Angeheftete Shapes (attachedToId) überspringen das, sie folgen
      // ihrem Host statt einem Container-Konzept.
      if (draggingShapeId.current) {
        const idsToCheck = dragGroupIds.current.length > 0 ? dragGroupIds.current : [draggingShapeId.current];
        for (const shapeId of idsToCheck) {
          const shape = useCanvasStore.getState().shapes[shapeId];
          const definition = shape ? ShapeRegistry.get(shape.type) : undefined;
          if (!shape || !definition || shape.attachedToId) continue;
          const center = {
            x: shape.position.x + shape.size.width / 2,
            y: shape.position.y + shape.size.height / 2,
          };
          if (!definition.isContainer) {
            const containerId = findContainerAt(useCanvasStore.getState().shapes, center, shapeId);
            if (containerId !== shape.parentId) setShapeParent(shapeId, containerId);
          } else {
            const containerId = findContainerAt(useCanvasStore.getState().shapes, center, shapeId);
            const currentShapes = useCanvasStore.getState().shapes;
            if (containerId && !isAncestor(currentShapes, shapeId, containerId) && containerId !== shape.parentId) {
              setShapeParent(shapeId, containerId);
            } else if (!containerId && shape.parentId) {
              setShapeParent(shapeId, undefined);
            }
          }
        }
        if (didDrag.current) pushHistorySnapshot();
      }

      setIsPanning(false);
      panStart.current = null;
      draggingShapeId.current = null;
      dragGroupIds.current = [];
      dragStartPositions.current = {};
      didDrag.current = false;
      setAlignmentGuides([]);
      setIsBulkDragging(false);
    },
    [
      viewport,
      shapes,
      addConnector,
      cancelConnectorDraft,
      setShapeParent,
      cancelReconnectDraft,
      setConnectorEndpoint,
      selectShapes,
      endSelectionRect,
    ]
  );

  // --- Port-Mousedown: startet das Ziehen einer neuen Verbindung ---
  const handlePortMouseDown = useCallback(
    (shapeId: string, portId: string, e: MouseEvent) => {
      e.stopPropagation();
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const worldX = (e.clientX - rect.left - viewport.x) / viewport.zoom;
      const worldY = (e.clientY - rect.top - viewport.y) / viewport.zoom;
      isDraggingConnector.current = true;
      startConnectorDraft(shapeId, portId, { x: worldX, y: worldY });
    },
    [viewport, startConnectorDraft]
  );

  // --- Endpunkt-Mousedown auf einer bestehenden Verbindung: startet das Neuandocken ---
  const handleEndpointMouseDown = useCallback(
    (connectorId: string, end: "source" | "target", e: MouseEvent) => {
      e.stopPropagation();
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const worldX = (e.clientX - rect.left - viewport.x) / viewport.zoom;
      const worldY = (e.clientY - rect.top - viewport.y) / viewport.zoom;
      isReconnecting.current = true;
      startReconnectDraft(connectorId, end, { x: worldX, y: worldY });
    },
    [viewport, startReconnectDraft]
  );

  // --- Shape-Drag starten ---
  const handleShapeMouseDown = useCallback(
    (e: MouseEvent, shapeId: string) => {
      e.stopPropagation();
      const shape = shapes[shapeId];
      if (!shape) return;

      // Klick auf den +/- Marker eines Sub-Prozesses: nur auf-/zuklappen,
      // keine Selektion/Drag auslösen. Erkennung über data-Attribut statt
      // harter BPMN-Typprüfung, damit die Core-Engine generisch bleibt -
      // jedes Modul kann diese Konvention für "Klick-Marker in einer Shape"
      // nutzen, indem es data-subprocess-toggle (oder künftig andere Marker)
      // auf das jeweilige <g>-Element setzt.
      const target = e.target as SVGElement;
      if (target.closest('[data-subprocess-toggle="true"]')) {
        const definition = ShapeRegistry.get(shape.type);
        const isExpanded = (shape.data.expanded as boolean) ?? false;
        const newExpanded = !isExpanded;
        const newSize = newExpanded ? definition?.expandedSize : definition?.collapsedSize;
        updateShape(shapeId, {
          data: { ...shape.data, expanded: newExpanded },
          ...(newSize ? { size: newSize } : {}),
        });
        pushHistorySnapshot();
        return;
      }

      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const worldX = (e.clientX - rect.left - viewport.x) / viewport.zoom;
      const worldY = (e.clientY - rect.top - viewport.y) / viewport.zoom;
      dragOffset.current = { x: worldX - shape.position.x, y: worldY - shape.position.y };
      draggingShapeId.current = shapeId;
      didDrag.current = false;

      const currentSelection = useCanvasStore.getState().selectedShapeIds;
      if (e.shiftKey) {
        selectShape(shapeId, true);
        // Nach dem additiven Toggle die (ggf. neue) Selektion für die Gruppe nutzen
        const updated = useCanvasStore.getState().selectedShapeIds;
        dragGroupIds.current = updated.includes(shapeId) ? updated : [shapeId];
      } else if (shape.groupId && !currentSelection.includes(shapeId)) {
        // Klick auf ein Mitglied einer festen Gruppe (Strg+G): die komplette
        // Gruppe wird selektiert, wie in draw.io/Lucidchart üblich. Ein
        // Doppelklick (siehe handleShapeDoubleClick) geht stattdessen "hinein"
        // und editiert nur das einzelne Element.
        const groupIds = getGroupMemberIds(shapeId);
        selectShapes(groupIds);
        dragGroupIds.current = groupIds;
      } else if (currentSelection.includes(shapeId) && currentSelection.length > 1) {
        // Klick auf ein bereits mitselektiertes Element in einer Mehrfachauswahl:
        // Auswahl bleibt bestehen, die ganze Gruppe wird gemeinsam gezogen.
        dragGroupIds.current = currentSelection;
      } else {
        selectShape(shapeId, false);
        dragGroupIds.current = [shapeId];
      }

      // Ausgangspositionen aller Gruppenmitglieder merken (für konsistente Deltas).
      const startPositions: Record<string, { x: number; y: number }> = {};
      for (const id of dragGroupIds.current) {
        const s = useCanvasStore.getState().shapes[id];
        if (s) startPositions[id] = { ...s.position };
      }
      dragStartPositions.current = startPositions;
    },
    [shapes, viewport, selectShape, getGroupMemberIds, selectShapes, updateShape]
  );

  // --- Resize starten ---
  const handleResizeStart = useCallback((shapeId: string, e: MouseEvent) => {
    const shape = useCanvasStore.getState().shapes[shapeId];
    if (!shape) return;
    resizingShapeId.current = shapeId;
    didResize.current = false;
    resizeStart.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      width: shape.size.width,
      height: shape.size.height,
      aspectRatio: shape.size.width / shape.size.height,
    };
  }, []);

  // --- Wegpunkt hinzufügen (Ziehen an einer Linien-Segmentmitte) ---
  const handleAddWaypoint = useCallback(
    (connectorId: string, _index: number, point: { x: number; y: number }) => {
      insertManualWaypoint(connectorId, 0, point);
      draggingWaypoint.current = { connectorId, index: 0 };
    },
    [insertManualWaypoint]
  );

  // --- Bestehenden Wegpunkt greifen ---
  const handleWaypointMouseDown = useCallback((connectorId: string, index: number, e: MouseEvent) => {
    e.stopPropagation();
    draggingWaypoint.current = { connectorId, index };
  }, []);

  // --- Wegpunkt per Doppelklick entfernen ---
  const handleWaypointDoubleClick = useCallback(
    (connectorId: string, index: number) => {
      removeManualWaypoint(connectorId, index);
      pushHistorySnapshot();
    },
    [removeManualWaypoint]
  );

  // --- Drop von Toolbox-Elementen ---
  const handleDrop = useCallback(
    (e: React.DragEvent<SVGSVGElement>) => {
      e.preventDefault();
      const shapeType = e.dataTransfer.getData("application/shape-type");
      if (!shapeType) return;
      const definition = ShapeRegistry.get(shapeType);
      if (!definition) return;

      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const worldX = (e.clientX - rect.left - viewport.x) / viewport.zoom;
      const worldY = (e.clientY - rect.top - viewport.y) / viewport.zoom;

      // Anheftbare Shapes (z.B. Boundary Event): statt normal zu platzieren,
      // wird die nächstgelegene Host-Shape unter dem Mauszeiger gesucht und
      // die neue Shape an deren Rand angeheftet.
      if (definition.isAttachable) {
        const host = Object.values(shapes).find((s) => {
          const hostDef = ShapeRegistry.get(s.type);
          if (hostDef?.isContainer || hostDef?.isAttachable) return false;
          return (
            worldX >= s.position.x &&
            worldX <= s.position.x + s.size.width &&
            worldY >= s.position.y &&
            worldY <= s.position.y + s.size.height
          );
        });

        if (host) {
          const ratio = ratioForPointOnRect({ x: worldX, y: worldY }, host.position, host.size);
          const newShape = {
            id: `shape_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            type: shapeType,
            position: { x: 0, y: 0 }, // wird direkt unten über getAttachedPosition korrekt gesetzt
            size: definition.defaultSize,
            data: { ...(definition.defaultData ?? {}) },
            zIndex: Object.keys(shapes).length,
            attachedToId: host.id,
            attachmentRatio: ratio,
          };
          newShape.position = getAttachedPosition(newShape, host);
          addShape(newShape);
          pushHistorySnapshot();
          return;
        }
        // Kein Host unter dem Mauszeiger: anheftbare Shapes ohne Host machen
        // fachlich keinen Sinn (ein Boundary Event braucht einen Task) -
        // Ablegen wird schlicht ignoriert, statt eine "schwebende" Kopie zu erzeugen.
        return;
      }

      const position = {
        x: worldX - definition.defaultSize.width / 2,
        y: worldY - definition.defaultSize.height / 2,
      };
      const center = {
        x: position.x + definition.defaultSize.width / 2,
        y: position.y + definition.defaultSize.height / 2,
      };
      const parentId = definition.isContainer ? undefined : findContainerAt(shapes, center);

      addShape({
        id: `shape_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        type: shapeType,
        position,
        size: definition.defaultSize,
        data: { ...(definition.defaultData ?? {}) },
        zIndex: Object.keys(shapes).length,
        parentId,
      });
      pushHistorySnapshot();
    },
    [viewport, addShape, shapes]
  );

  const cursor = isPanning ? "grabbing" : isSpaceDown ? "grab" : "default";

  const sortedShapes = useMemo(() => {
    return Object.values(shapes).sort((a, b) => {
      const aIsContainer = ShapeRegistry.get(a.type)?.isContainer ?? false;
      const bIsContainer = ShapeRegistry.get(b.type)?.isContainer ?? false;
      if (aIsContainer === bIsContainer) return a.zIndex - b.zIndex;
      return aIsContainer ? -1 : 1;
    });
  }, [shapes]);

  // Kinder eines eingeklappten auf-/zuklappbaren Containers (z.B. Sub-Prozess)
  // werden ausgeblendet, statt "frei schwebend" über dem kleinen Symbol
  // sichtbar zu bleiben. Generisch über collapsedSize/expandedSize + data.expanded,
  // kein BPMN-Wissen in der Core-Engine nötig. Prüft sowohl die Container-Kette
  // (parentId) als auch die Anheft-Kette (attachedToId, z.B. Boundary Event an
  // einem Task, der selbst in einem eingeklappten Sub-Prozess versteckt ist).
  const isShapeVisible = useCallback(
    (shape: ShapeInstance): boolean => {
      let current: ShapeInstance | undefined = shape;
      const visited = new Set<string>();
      while (current) {
        const nextId: string | undefined = current.parentId ?? current.attachedToId;
        if (!nextId || visited.has(nextId)) break;
        visited.add(nextId);
        const next: ShapeInstance | undefined = shapes[nextId];
        if (!next) break;
        const nextDef = ShapeRegistry.get(next.type);
        const isCollapsible = Boolean(nextDef?.collapsedSize && nextDef?.expandedSize);
        if (isCollapsible && !next.data.expanded) return false;
        current = next;
      }
      return true;
    },
    [shapes]
  );

  return (
    <div ref={containerRef} className="canvas-container" style={{ width: "100%", height: "100%", overflow: "hidden" }}>
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        style={{ cursor, background: "var(--canvas-bg, #fafafa)" }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        <GridLayer viewport={viewport} gridSize={gridSize} />

        <g transform={`translate(${viewport.x} ${viewport.y}) scale(${viewport.zoom})`}>
          <ConnectorLayer
            shapes={shapes}
            connectors={connectors}
            connectorDraft={connectorDraft}
            reconnectDraft={reconnectDraft}
            selectedConnectorId={selectedConnectorId}
            onSelectConnector={selectConnector}
            onDoubleClickConnector={handleConnectorDoubleClick}
            onEndpointMouseDown={handleEndpointMouseDown}
            onAddWaypoint={handleAddWaypoint}
            onWaypointMouseDown={handleWaypointMouseDown}
            onWaypointDoubleClick={handleWaypointDoubleClick}
            useRouting={!isBulkDragging}
          />

          {sortedShapes.map((shape) => {
            if (!isShapeVisible(shape)) return null;
            const definition = ShapeRegistry.get(shape.type);
            if (!definition) return null;
            const ShapeComponent = definition.render;
            const showPorts = hoveredShapeId === shape.id || isDraggingConnector.current;
            const isSelected = selectedShapeIds.includes(shape.id);
            return (
              <g
                key={shape.id}
                onMouseDown={(e) => handleShapeMouseDown(e, shape.id)}
                onDoubleClick={(e) => handleShapeDoubleClick(e, shape.id)}
                onMouseEnter={() => setHoveredShape(shape.id)}
                onMouseLeave={() => setHoveredShape(null)}
                style={{ cursor: "move" }}
              >
                <ShapeComponent shape={shape} isSelected={isSelected} />
                <g transform={`translate(${shape.position.x} ${shape.position.y})`}>
                  <ShapePorts
                    shape={shape}
                    visible={showPorts}
                    onPortMouseDown={(portId, e) => handlePortMouseDown(shape.id, portId, e)}
                  />
                  {isSelected && !shape.attachedToId && (
                    <ResizeHandle
                      width={shape.size.width}
                      height={shape.size.height}
                      onResizeStart={(e) => handleResizeStart(shape.id, e)}
                    />
                  )}
                </g>
              </g>
            );
          })}

          <AlignmentGuidesLayer guides={alignmentGuides} />

          {selectionRect && (
            <rect
              x={Math.min(selectionRect.startX, selectionRect.currentX)}
              y={Math.min(selectionRect.startY, selectionRect.currentY)}
              width={Math.abs(selectionRect.currentX - selectionRect.startX)}
              height={Math.abs(selectionRect.currentY - selectionRect.startY)}
              fill="rgba(74, 144, 217, 0.12)"
              stroke="var(--accent, #3d5a99)"
              strokeWidth={1}
              strokeDasharray="4 3"
              style={{ pointerEvents: "none" }}
            />
          )}

          {editingShapeId && shapes[editingShapeId] && (() => {
            const shape = shapes[editingShapeId];
            const overlayHeight = Math.max(32, shape.size.height - 10);
            return (
              <foreignObject
                x={shape.position.x - 10}
                y={shape.position.y + (shape.size.height - overlayHeight) / 2}
                width={shape.size.width + 20}
                height={overlayHeight}
                style={{ overflow: "visible" }}
              >
                <textarea
                  autoFocus
                  value={editingValue}
                  onChange={(e) => setEditingValue(e.target.value)}
                  onBlur={commitEditing}
                  onFocus={(e) => e.target.select()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      commitEditing();
                    }
                    if (e.key === "Escape") setEditingShapeId(null);
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  rows={Math.max(1, editingValue.split("\n").length)}
                  style={{
                    width: "100%",
                    height: "100%",
                    boxSizing: "border-box",
                    textAlign: "center",
                    fontSize: 13,
                    fontFamily: "inherit",
                    border: "1px solid var(--accent, #3d5a99)",
                    borderRadius: 4,
                    padding: "4px 6px",
                    background: "#ffffff",
                    resize: "none",
                    overflow: "hidden",
                  }}
                />
              </foreignObject>
            );
          })()}

          {editingConnectorId && connectors[editingConnectorId] && (() => {
            const connector = connectors[editingConnectorId];
            const sourceShape = shapes[connector.sourceShapeId];
            const targetShape = shapes[connector.targetShapeId];
            if (!sourceShape || !targetShape) return null;
            const midX = (sourceShape.position.x + targetShape.position.x) / 2;
            const midY = (sourceShape.position.y + targetShape.position.y) / 2;
            const lines = Math.max(1, editingValue.split("\n").length);
            const overlayHeight = 24 + (lines - 1) * 18;
            return (
              <foreignObject x={midX - 60} y={midY - overlayHeight / 2} width={120} height={overlayHeight} style={{ overflow: "visible" }}>
                <textarea
                  autoFocus
                  value={editingValue}
                  onChange={(e) => setEditingValue(e.target.value)}
                  onBlur={commitEditing}
                  onFocus={(e) => e.target.select()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      commitEditing();
                    }
                    if (e.key === "Escape") setEditingConnectorId(null);
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  rows={lines}
                  style={{
                    width: "100%",
                    height: "100%",
                    boxSizing: "border-box",
                    textAlign: "center",
                    fontSize: 12,
                    fontFamily: "inherit",
                    border: "1px solid var(--accent, #3d5a99)",
                    borderRadius: 4,
                    padding: "3px 6px",
                    background: "#ffffff",
                    resize: "none",
                    overflow: "hidden",
                  }}
                />
              </foreignObject>
            );
          })()}
        </g>
      </svg>
    </div>
  );
}
