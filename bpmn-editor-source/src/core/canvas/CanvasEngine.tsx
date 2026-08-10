import { useRef, useState, useCallback, useEffect, useMemo, type MouseEvent } from "react";
import { useCanvasStore, type AlignMode } from "../state/canvasStore";
import type { ShapeInstance, Point, Size } from "../shapes/types";
import { GridLayer } from "./GridLayer";
import { ShapeRegistry } from "../shapes/ShapeRegistry";
import { ConnectorTypeRegistry } from "../shapes/ConnectorTypeRegistry";
import { ShapePorts } from "./ShapePorts";
import { ConnectorLayer, ConnectorEndpointHandles } from "./ConnectorLayer";
import { findPortNear, findFreePortOnShapeBorder, findPortOnShapeAtPoint, freePortId } from "./connectorGeometry";
import { findContainerAt, isAncestor } from "./containment";
import { ResizeHandle, type ResizeDirection } from "./ResizeHandle";
import { RotateHandle } from "./RotateHandle";
import { HoverArrows, type HoverDirection } from "./HoverArrows";
import { Rulers } from "./Rulers";
import { ContextMenu, type ContextMenuSection } from "./ContextMenu";
import { copySelectionToClipboard, pasteClipboard, hasClipboardContent } from "../state/clipboard";
import { computeAlignmentGuides, type AlignmentGuide } from "./alignmentGuides";
import { AlignmentGuidesLayer } from "./AlignmentGuidesLayer";
import { pushHistorySnapshot, undo, redo } from "../state/history";
import { ratioForPointOnRect, getAttachedPosition } from "./attachmentGeometry";

const PAGE_SIZE = { width: 794, height: 1123 }; // A4 bei ~96dpi, Z-18
const GUIDE_SNAP_TOLERANCE = 6; // Bildschirmpixel, unabhängig vom Zoom (siehe Anwendung unten)

const RELATIVE_POSITION_FOR_DIRECTION: Record<HoverDirection, { x: number; y: number }> = {
  top: { x: 0.5, y: 0 },
  right: { x: 1, y: 0.5 },
  bottom: { x: 0.5, y: 1 },
  left: { x: 0, y: 0.5 },
};

function oppositeHoverDirection(direction: HoverDirection): HoverDirection {
  if (direction === "top") return "bottom";
  if (direction === "bottom") return "top";
  if (direction === "left") return "right";
  return "left";
}

/** Findet den Port, der am ehesten "in Richtung `direction`" liegt (Extremum
 *  seiner relativen Position) - generisch für beliebige Modul-Portsätze,
 *  siehe Anwendung in createShapeFromHoverArrow (Z-06). */
function pickPortForDirection(
  ports: { id: string; relativePosition: { x: number; y: number } }[],
  direction: HoverDirection
): { id: string; relativePosition: { x: number; y: number } } | undefined {
  if (ports.length === 0) return undefined;
  if (direction === "top") return ports.reduce((best, p) => (p.relativePosition.y < best.relativePosition.y ? p : best));
  if (direction === "bottom") return ports.reduce((best, p) => (p.relativePosition.y > best.relativePosition.y ? p : best));
  if (direction === "left") return ports.reduce((best, p) => (p.relativePosition.x < best.relativePosition.x ? p : best));
  return ports.reduce((best, p) => (p.relativePosition.x > best.relativePosition.x ? p : best));
}

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
  const setConnectorLabelOffset = useCanvasStore((s) => s.setConnectorLabelOffset);
  const startSelectionRect = useCanvasStore((s) => s.startSelectionRect);
  const updateSelectionRect = useCanvasStore((s) => s.updateSelectionRect);
  const endSelectionRect = useCanvasStore((s) => s.endSelectionRect);
  const setShapeRotation = useCanvasStore((s) => s.setShapeRotation);
  const alignShapes = useCanvasStore((s) => s.alignShapes);
  const distributeShapes = useCanvasStore((s) => s.distributeShapes);
  const removeConnector = useCanvasStore((s) => s.removeConnector);
  const setViewport = useCanvasStore((s) => s.setViewport);
  const setViewportSize = useCanvasStore((s) => s.setViewportSize);
  const resizeShapeWithPosition = useCanvasStore((s) => s.resizeShapeWithPosition);
  const resizeShapesScaled = useCanvasStore((s) => s.resizeShapesScaled);
  const flipShapes = useCanvasStore((s) => s.flipShapes);
  const setShapeLocked = useCanvasStore((s) => s.setShapeLocked);
  const setShapeHidden = useCanvasStore((s) => s.setShapeHidden);
  const unhideAllShapes = useCanvasStore((s) => s.unhideAllShapes);
  const matchShapeSizes = useCanvasStore((s) => s.matchShapeSizes);
  const formatPainterClipboard = useCanvasStore((s) => s.formatPainterClipboard);
  const copyFormatFromShape = useCanvasStore((s) => s.copyFormatFromShape);
  const copyFormatFromConnector = useCanvasStore((s) => s.copyFormatFromConnector);
  const applyFormatPainterToShapes = useCanvasStore((s) => s.applyFormatPainterToShapes);
  const applyFormatPainterToConnectors = useCanvasStore((s) => s.applyFormatPainterToConnectors);
  const cancelFormatPainter = useCanvasStore((s) => s.cancelFormatPainter);
  // "persistedGuides" (nicht "guides"), um Verwechslung mit den lokalen,
  // passiven Alignment-Guides (siehe computeAlignmentGuides weiter unten) zu
  // vermeiden - beide Konzepte heißen umgangssprachlich "Hilfslinien", sind
  // aber unabhängig (persistedGuides = Lineal-Hilfslinien, Z-17).
  const persistedGuides = useCanvasStore((s) => s.guides);
  const moveGuide = useCanvasStore((s) => s.moveGuide);
  const removeGuide = useCanvasStore((s) => s.removeGuide);
  const showPagePreview = useCanvasStore((s) => s.showPagePreview);
  const togglePagePreview = useCanvasStore((s) => s.togglePagePreview);
  const zoomToFit = useCanvasStore((s) => s.zoomToFit);
  const zoomToSelection = useCanvasStore((s) => s.zoomToSelection);

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

  // Drag-State für das freie Verschieben eines Verbinder-Labels (labelOffset)
  const draggingLabel = useRef<{
    connectorId: string;
    startOffset: { x: number; y: number };
    startWorldX: number;
    startWorldY: number;
  } | null>(null);

  // Während des Verschiebens vieler Elemente gleichzeitig (Gruppen-Drag) wird
  // das teure A*-Routing kurzzeitig übersprungen, damit die App flüssig bleibt.
  const [isBulkDragging, setIsBulkDragging] = useState(false);

  // Resize-State für Elemente. `direction` erlaubt Resize-Griffe an allen 8
  // Punkten (Z-01) statt nur unten-rechts: je nach Griff ändert sich nicht
  // nur die Größe, sondern teils auch die Position (z.B. Griff oben-links
  // verschiebt zusätzlich x/y, damit die gegenüberliegende Ecke fix bleibt).
  const resizingShapeId = useRef<string | null>(null);
  const resizeStart = useRef<{
    mouseX: number;
    mouseY: number;
    x: number;
    y: number;
    width: number;
    height: number;
    aspectRatio: number;
    direction: ResizeDirection;
  }>({
    mouseX: 0,
    mouseY: 0,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    aspectRatio: 1,
    direction: "se",
  });
  const didResize = useRef(false);

  // Mehrfachauswahl-Resize (Z-03): skaliert alle selektierten Shapes
  // gemeinsam relativ zu einer festen Ursprungsecke der Auswahl-Bounding-Box.
  const groupResizing = useRef<{
    ids: string[];
    direction: ResizeDirection;
    mouseX: number;
    mouseY: number;
    bbox: { x: number; y: number; width: number; height: number };
    aspectRatio: number;
    // Position/Größe jeder Shape VOM DRAG-START, eingefroren - resizeShapesScaled
    // skaliert relativ dazu, nicht relativ zum (bei jedem mousemove schon
    // veränderten) aktuellen Store-Zustand. Ohne das compoundet der
    // Skalierungsfaktor über mehrere mousemove-Events multiplikativ (realer
    // Bug, siehe Abschnitt 6 der technischen Doku).
    originalGeometry: Record<string, { position: Point; size: Size }>;
  } | null>(null);
  const didGroupResize = useRef(false);

  // Gerichtete Hover-Pfeile (Z-06): Ziehen von einem Pfeil verhält sich wie
  // ein normaler Verbindungs-Draft (isDraggingConnector), merkt sich aber
  // zusätzlich Richtung/Startpunkt, damit beim Loslassen ohne Zielshape ein
  // neues, verbundenes Shape erzeugt werden kann statt den Vorgang nur
  // abzubrechen (siehe handleMouseUp).
  const hoverArrowDraft = useRef<{ shapeId: string; direction: HoverDirection; startX: number; startY: number } | null>(null);

  // Rotations-State für Elemente. startAngle/startRotation erlauben eine
  // stetige Drehung ohne Sprung: der Offset zwischen Maus-Winkel und
  // aktueller Rotation beim Greifen bleibt über die ganze Geste konstant.
  const rotatingShapeId = useRef<string | null>(null);
  const rotateStart = useRef<{ centerX: number; centerY: number; startAngle: number; startRotation: number }>({
    centerX: 0,
    centerY: 0,
    startAngle: 0,
    startRotation: 0,
  });
  const didRotate = useRef(false);

  // Rechtsklick-Kontextmenü (Shape/Verbindung/leere Fläche)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; sections: ContextMenuSection[] } | null>(
    null
  );
  const closeContextMenu = useCallback(() => setContextMenu(null), []);

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
          // Gesperrte Shapes (Z-05) werden vom Löschen ausgenommen - Sperren
          // soll auch versehentliches Löschen per Tastenkürzel verhindern.
          state.selectedShapeIds.forEach((id) => {
            if (!state.shapes[id]?.locked) state.removeShape(id);
          });
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
      // Strg+D dupliziert die Auswahl - dieselbe Kopieren-und-Einfuegen-Folge,
      // die auch der Menuepunkt "Duplizieren" ausloest (MenuBar.tsx). Ohne
      // preventDefault oeffnet der Browser stattdessen sein Lesezeichen-Fenster.
      if ((e.ctrlKey || e.metaKey) && e.code === "KeyD" && !isTypingContext) {
        e.preventDefault();
        copySelectionToClipboard();
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
        // Gesperrte Shapes (Z-05) werden vom Pfeiltasten-Nudge ausgenommen.
        const movableIds = state.selectedShapeIds.filter((id) => !state.shapes[id]?.locked);
        if (movableIds.length > 0) {
          e.preventDefault();
          const step = e.shiftKey ? state.gridSize : 1;
          const delta = { x: arrowDeltas[e.code].x * step, y: arrowDeltas[e.code].y * step };
          moveShapesBy(movableIds, delta);
        }
      }

      if (e.code === "Escape") {
        cancelConnectorDraft();
        isDraggingConnector.current = false;
        cancelReconnectDraft();
        isReconnecting.current = false;
        cancelFormatPainter(); // Z-14: Formatpinsel-Modus ebenfalls über Escape abbrechbar
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
  }, [cancelConnectorDraft, cancelReconnectDraft, selectShapes, groupShapes, ungroupShapes, moveShapesBy, cancelFormatPainter]);

  // --- Zoom via Mausrad ---
  // Bewusst ein NATIVER, nicht-passiver Event-Listener statt React's
  // synthetischem onWheel: nur so ist garantiert, dass preventDefault()
  // zuverlässig auch Strg+Mausrad (Browser-Zoom der ganzen Seite) und
  // Trackpad-Pinch unterdrückt. Ohne das könnte der Browser zusätzlich zum
  // eigenen Canvas-Zoom die GANZE Seite skalieren/verschieben - optisch
  // nicht von einem Mitskalieren von Toolbar/Toolbox/Properties zu
  // unterscheiden, obwohl CanvasEngine.tsx selbst nur die eigene <g>
  // transformiert (siehe App.css: touch-action/overscroll-behavior auf
  // .canvas-area als zusätzliche Absicherung).
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const handleNativeWheel = (e: globalThis.WheelEvent) => {
      e.preventDefault();
      const rect = svg.getBoundingClientRect();
      zoomAt(e.clientX - rect.left, e.clientY - rect.top, e.deltaY);
    };
    // Safari/WebKit feuert bei Trackpad-Pinch eigene, nicht-standardisierte
    // Gesture-Events statt wheel+ctrlKey (anders als Chrome/Firefox) - hier
    // nur unterdrücken (Safari-Pinch löst dadurch bewusst keinen eigenen
    // Canvas-Zoom aus, das war auch vorher nicht unterstützt), damit
    // zumindest nicht die ganze Seite mitzoomt.
    const preventGesture = (e: Event) => e.preventDefault();

    svg.addEventListener("wheel", handleNativeWheel, { passive: false });
    svg.addEventListener("gesturestart", preventGesture);
    svg.addEventListener("gesturechange", preventGesture);

    return () => {
      svg.removeEventListener("wheel", handleNativeWheel);
      svg.removeEventListener("gesturestart", preventGesture);
      svg.removeEventListener("gesturechange", preventGesture);
    };
  }, [zoomAt]);

  // --- Zeichenflächen-Pixelgröße im Store aktuell halten (Z-16: zoomToFit/
  //     zoomToSelection brauchen sie, der Store selbst kennt kein DOM). ---
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const update = () => setViewportSize({ width: container.clientWidth, height: container.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    return () => observer.disconnect();
  }, [setViewportSize]);

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

      if (draggingLabel.current) {
        const { connectorId, startOffset, startWorldX, startWorldY } = draggingLabel.current;
        setConnectorLabelOffset(connectorId, {
          x: startOffset.x + (worldX - startWorldX),
          y: startOffset.y + (worldY - startWorldY),
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
      if (groupResizing.current) {
        didGroupResize.current = true;
        const { direction, mouseX, mouseY, bbox, aspectRatio } = groupResizing.current;
        const dx = (e.clientX - mouseX) / viewport.zoom;
        const dy = (e.clientY - mouseY) / viewport.zoom;
        const MIN_SIZE = 24;

        // Vorzeichen je nach Griff: Griffe auf der "n"/"w"-Seite verkleinern
        // bei positivem dx/dy (ziehen den Rand nach innen), "s"/"e"-Griffe
        // vergrößern - Ecken kombinieren beide Achsen.
        const affectsWidth = direction.includes("e") || direction.includes("w");
        const affectsHeight = direction.includes("n") || direction.includes("s");
        const widthSign = direction.includes("w") ? -1 : 1;
        const heightSign = direction.includes("n") ? -1 : 1;

        let newWidth = affectsWidth ? Math.max(MIN_SIZE, bbox.width + dx * widthSign) : bbox.width;
        let newHeight = affectsHeight ? Math.max(MIN_SIZE, bbox.height + dy * heightSign) : bbox.height;

        // Seitenverhältnis-Sperre (Z-02) nur an Eckgriffen sinnvoll (beide
        // Achsen ändern sich dort ohnehin schon gemeinsam).
        if (e.shiftKey && affectsWidth && affectsHeight) {
          if (Math.abs(dx) >= Math.abs(dy)) newHeight = Math.max(MIN_SIZE, newWidth / aspectRatio);
          else newWidth = Math.max(MIN_SIZE, newHeight * aspectRatio);
        }

        const scaleX = newWidth / bbox.width;
        const scaleY = newHeight / bbox.height;
        // Ursprung = die dem gezogenen Griff gegenüberliegende Ecke der
        // Bounding-Box, damit diese beim Skalieren fix bleibt.
        const originX = direction.includes("w") ? bbox.x + bbox.width : bbox.x;
        const originY = direction.includes("n") ? bbox.y + bbox.height : bbox.y;

        resizeShapesScaled(
          groupResizing.current.ids,
          groupResizing.current.originalGeometry,
          { x: originX, y: originY },
          scaleX,
          scaleY
        );
        return;
      }

      if (resizingShapeId.current) {
        didResize.current = true;
        const { direction, x, y, width, height, aspectRatio } = resizeStart.current;
        const dx = (e.clientX - resizeStart.current.mouseX) / viewport.zoom;
        const dy = (e.clientY - resizeStart.current.mouseY) / viewport.zoom;
        const MIN_SIZE = 24;

        const affectsWidth = direction.includes("e") || direction.includes("w");
        const affectsHeight = direction.includes("n") || direction.includes("s");

        let newWidth = affectsWidth ? Math.max(MIN_SIZE, width + dx * (direction.includes("w") ? -1 : 1)) : width;
        let newHeight = affectsHeight ? Math.max(MIN_SIZE, height + dy * (direction.includes("n") ? -1 : 1)) : height;

        // Seitenverhältnis-Sperre (Z-02, bestand bisher schon für den
        // einzigen "se"-Griff) - an Eckgriffen weiterhin per Shift aktivierbar.
        if (e.shiftKey && affectsWidth && affectsHeight) {
          if (Math.abs(dx) >= Math.abs(dy)) newHeight = Math.max(MIN_SIZE, newWidth / aspectRatio);
          else newWidth = Math.max(MIN_SIZE, newHeight * aspectRatio);
        }

        // Griffe auf der "n"/"w"-Seite verschieben zusätzlich die Position,
        // damit die GEGENÜBERLIEGENDE Ecke fix bleibt (Z-01: alle 8 Punkte
        // statt nur unten-rechts, wo die Position bisher nie berührt wurde).
        const newX = direction.includes("w") ? x + width - newWidth : x;
        const newY = direction.includes("n") ? y + height - newHeight : y;

        resizeShapeWithPosition(resizingShapeId.current, { x: newX, y: newY }, { width: newWidth, height: newHeight });
        return;
      }
      if (rotatingShapeId.current) {
        didRotate.current = true;
        const { centerX, centerY, startAngle, startRotation } = rotateStart.current;
        const currentAngle = (Math.atan2(worldY - centerY, worldX - centerX) * 180) / Math.PI;
        let rotation = startRotation + (currentAngle - startAngle);
        if (e.shiftKey) rotation = Math.round(rotation / 15) * 15;
        setShapeRotation(rotatingShapeId.current, rotation);
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

        // Zusätzliches Einrasten an per Lineal gezogenen Hilfslinien (Z-17) -
        // unabhängig vom passiven Alignment-Guide-Snapping oben, deshalb ein
        // separater Nachbearbeitungsschritt statt eine Erweiterung von
        // computeAlignmentGuides (die kennt persistedGuides bewusst nicht).
        let finalPosition = snappedPosition;
        let hasGuideSnap = false;
        if (persistedGuides.length > 0) {
          const tolerance = GUIDE_SNAP_TOLERANCE / viewport.zoom;
          for (const g of persistedGuides) {
            if (g.axis === "vertical") {
              if (Math.abs(finalPosition.x - g.position) < tolerance) {
                finalPosition = { ...finalPosition, x: g.position };
                hasGuideSnap = true;
              } else if (Math.abs(finalPosition.x + shape.size.width - g.position) < tolerance) {
                finalPosition = { ...finalPosition, x: g.position - shape.size.width };
                hasGuideSnap = true;
              }
            } else {
              if (Math.abs(finalPosition.y - g.position) < tolerance) {
                finalPosition = { ...finalPosition, y: g.position };
                hasGuideSnap = true;
              } else if (Math.abs(finalPosition.y + shape.size.height - g.position) < tolerance) {
                finalPosition = { ...finalPosition, y: g.position - shape.size.height };
                hasGuideSnap = true;
              }
            }
          }
        }

        if (dragGroupIds.current.length > 1) {
          // Mehrfachauswahl: Delta relativ zur Anker-Shape auf alle anderen
          // ausgewählten Elemente übertragen, damit die Gruppe als Ganzes
          // mitwandert statt nur das angeklickte Element.
          if (!isBulkDragging) setIsBulkDragging(true);
          const anchorStart = dragStartPositions.current[shapeId];
          if (anchorStart) {
            moveShapesBy(dragGroupIds.current, {
              x: finalPosition.x - shape.position.x,
              y: finalPosition.y - shape.position.y,
            });
          }
        } else {
          const hasAlignmentSnap = guides.length > 0 || hasGuideSnap;
          moveShape(shapeId, finalPosition, hasAlignmentSnap);
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
      resizeShapeWithPosition,
      resizeShapesScaled,
      setShapeRotation,
      updateReconnectDraft,
      shapes,
      updateSelectionRect,
      isBulkDragging,
      updateShape,
      persistedGuides,
    ]
  );

  // --- Erzeugt beim Loslassen eines Hover-Pfeil-Drags ohne Zielshape ein
  //     neues, verbundenes Shape vom selben Typ wie die Quelle (Z-06). ---
  const createShapeFromHoverArrow = useCallback(
    (
      origin: { shapeId: string; direction: HoverDirection; startX: number; startY: number },
      dropPoint: { x: number; y: number }
    ) => {
      const sourceShape = shapes[origin.shapeId];
      const definition = sourceShape ? ShapeRegistry.get(sourceShape.type) : undefined;
      if (!sourceShape || !definition) return;

      const GAP = 60;
      const size = sourceShape.size;
      let position: { x: number; y: number };

      // Wenig Bewegung seit Drag-Start = einfacher Klick: fester Versatz in
      // Pfeilrichtung, auf gleicher Achse wie die Quelle. Deutliche Bewegung
      // (Klick+Ziehen) lässt stattdessen die Zugposition die Platzierung
      // entlang der Querachse bestimmen (siehe Z-06-Anforderungstext).
      const dragDistance = Math.hypot(dropPoint.x - origin.startX, dropPoint.y - origin.startY);
      const didDragFar = dragDistance > 12;

      if (origin.direction === "right") {
        position = {
          x: sourceShape.position.x + sourceShape.size.width + GAP,
          y: didDragFar ? dropPoint.y - size.height / 2 : sourceShape.position.y,
        };
      } else if (origin.direction === "left") {
        position = {
          x: sourceShape.position.x - size.width - GAP,
          y: didDragFar ? dropPoint.y - size.height / 2 : sourceShape.position.y,
        };
      } else if (origin.direction === "bottom") {
        position = {
          x: didDragFar ? dropPoint.x - size.width / 2 : sourceShape.position.x,
          y: sourceShape.position.y + sourceShape.size.height + GAP,
        };
      } else {
        position = {
          x: didDragFar ? dropPoint.x - size.width / 2 : sourceShape.position.x,
          y: sourceShape.position.y - size.height - GAP,
        };
      }

      const newShapeId = `shape_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const newShape: ShapeInstance = {
        id: newShapeId,
        type: sourceShape.type,
        position,
        size,
        data: { ...(definition.defaultData ?? {}) },
        zIndex: Object.keys(shapes).length,
      };
      addShape(newShape);

      // Passenden Port an Quelle und Ziel für die jeweilige Richtung suchen -
      // über die relative Position (Extremum in die jeweilige Richtung)
      // statt feste ID-Namen, damit es unabhängig davon funktioniert, wie ein
      // Modul seine Ports benennt. Ohne registrierte Ports (sollte für
      // Hover-Pfeile nicht vorkommen, da Container ausgeschlossen sind) wird
      // ersatzweise ein freier Port an der erwarteten Randposition genutzt
      // (Z-07-Mechanismus als generischer Fallback).
      const sourcePort = pickPortForDirection(definition.ports, origin.direction);
      const targetPort = pickPortForDirection(definition.ports, oppositeHoverDirection(origin.direction));
      const sourcePortId = sourcePort?.id ?? freePortId(RELATIVE_POSITION_FOR_DIRECTION[origin.direction]);
      const targetPortId = targetPort?.id ?? freePortId(RELATIVE_POSITION_FOR_DIRECTION[oppositeHoverDirection(origin.direction)]);

      addConnector({
        id: `conn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        sourceShapeId: origin.shapeId,
        sourcePortId,
        targetShapeId: newShapeId,
        targetPortId,
        waypoints: [],
      });
      pushHistorySnapshot();
    },
    [shapes, addShape, addConnector]
  );

  const handleMouseUp = useCallback(
    (e: MouseEvent<SVGSVGElement>) => {
      if (draggingWaypoint.current) {
        draggingWaypoint.current = null;
        pushHistorySnapshot();
      }

      if (draggingLabel.current) {
        draggingLabel.current = null;
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
        const arrowOrigin = hoverArrowDraft.current;
        hoverArrowDraft.current = null;
        if (draft) {
          const rect = svgRef.current?.getBoundingClientRect();
          if (rect) {
            const worldX = (e.clientX - rect.left - viewport.x) / viewport.zoom;
            const worldY = (e.clientY - rect.top - viewport.y) / viewport.zoom;
            const maxDistance = 25 / viewport.zoom;
            let target = findPortNear(shapes, { x: worldX, y: worldY }, maxDistance);
            // Kein fester Port getroffen: auf einen freien Verbindungspunkt am
            // Shape-Rand ausweichen (Z-07), statt den Verbindungsversuch
            // sofort aufzugeben.
            if (!target) target = findFreePortOnShapeBorder(shapes, { x: worldX, y: worldY }, maxDistance);
            // Immer noch nichts, aber mitten auf einer Shape losgelassen (F-11):
            // die Absicht ist eindeutig - andocken am Port, der der Quelle am
            // nächsten liegt.
            if (!target) {
              const quelle = shapes[draft.sourceShapeId];
              const von = quelle
                ? { x: quelle.position.x + quelle.size.width / 2, y: quelle.position.y + quelle.size.height / 2 }
                : { x: worldX, y: worldY };
              target = findPortOnShapeAtPoint(shapes, { x: worldX, y: worldY }, von);
            }

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
            } else if (arrowOrigin) {
              // Über einem gerichteten Hover-Pfeil gestartet (Z-06) und ohne
              // Ziel losgelassen: statt den Vorgang abzubrechen, wird ein
              // neues Shape vom selben Typ wie die Quelle erzeugt und direkt
              // verbunden - der eigentliche Zweck der Hover-Pfeile.
              createShapeFromHoverArrow(arrowOrigin, { x: worldX, y: worldY });
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
            const maxDistance = 25 / viewport.zoom;
            let target = findPortNear(shapes, { x: worldX, y: worldY }, maxDistance);
            if (!target) target = findFreePortOnShapeBorder(shapes, { x: worldX, y: worldY }, maxDistance);
            const connector = useCanvasStore.getState().connectors[draft.connectorId];
            const otherEndShapeId =
              connector && draft.end === "source" ? connector.targetShapeId : connector?.sourceShapeId;
            // Wie beim Neu-Verbinden (F-11): mitten auf einer Shape losgelassen
            // zählt als Andocken an dieser Shape. Bezugspunkt ist hier das
            // gegenüberliegende Ende der Verbindung.
            if (!target) {
              const gegenueber = otherEndShapeId ? shapes[otherEndShapeId] : undefined;
              const von = gegenueber
                ? { x: gegenueber.position.x + gegenueber.size.width / 2, y: gegenueber.position.y + gegenueber.size.height / 2 }
                : { x: worldX, y: worldY };
              target = findPortOnShapeAtPoint(shapes, { x: worldX, y: worldY }, von);
            }
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

      if (groupResizing.current) {
        groupResizing.current = null;
        if (didGroupResize.current) pushHistorySnapshot();
        didGroupResize.current = false;
      }

      if (rotatingShapeId.current) {
        rotatingShapeId.current = null;
        if (didRotate.current) pushHistorySnapshot();
        didRotate.current = false;
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
      createShapeFromHoverArrow,
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

  // --- Hover-Pfeil-Mousedown: startet wie ein normaler Verbindungs-Draft
  //     (Z-06), merkt sich aber zusätzlich Ursprungs-Richtung/-Punkt in
  //     hoverArrowDraft, damit handleMouseUp bei fehlendem Ziel ein neues,
  //     verbundenes Shape erzeugen kann statt nur abzubrechen. ---
  const handleHoverArrowMouseDown = useCallback(
    (shapeId: string, direction: HoverDirection, e: MouseEvent) => {
      e.stopPropagation();
      const shape = shapes[shapeId];
      const definition = shape ? ShapeRegistry.get(shape.type) : undefined;
      if (!shape || !definition) return;
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const worldX = (e.clientX - rect.left - viewport.x) / viewport.zoom;
      const worldY = (e.clientY - rect.top - viewport.y) / viewport.zoom;
      const port = pickPortForDirection(definition.ports, direction);
      const portId = port?.id ?? freePortId(RELATIVE_POSITION_FOR_DIRECTION[direction]);
      isDraggingConnector.current = true;
      hoverArrowDraft.current = { shapeId, direction, startX: worldX, startY: worldY };
      startConnectorDraft(shapeId, portId, { x: worldX, y: worldY });
    },
    [viewport, shapes, startConnectorDraft]
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

  // --- Verbindungs-Mousedown: normal selektieren, außer der Formatpinsel
  //     (Z-14) ist aktiv - dann wendet ein Klick stattdessen den kopierten
  //     Stil an (nur wenn das Clipboard von einer Verbindung stammt; stammt
  //     es von einer Shape, ist eine Verbindung kein passendes Ziel und der
  //     Klick wird ignoriert, der Modus bleibt aktiv). ---
  const handleConnectorMouseDown = useCallback(
    (connectorId: string) => {
      if (formatPainterClipboard) {
        if (formatPainterClipboard.kind === "connector") {
          applyFormatPainterToConnectors([connectorId]);
          pushHistorySnapshot();
        }
        return;
      }
      selectConnector(connectorId);
    },
    [formatPainterClipboard, applyFormatPainterToConnectors, selectConnector]
  );

  // --- Shape-Drag starten ---
  const handleShapeMouseDown = useCallback(
    (e: MouseEvent, shapeId: string) => {
      e.stopPropagation();
      const shape = shapes[shapeId];
      if (!shape) return;

      // Formatpinsel aktiv (Z-14): Klick wendet den kopierten Stil an,
      // statt die normale Auswahl-/Drag-Logik auszulösen. Stammt das
      // Clipboard von einer Verbindung (falscher `kind`), passt eine Shape
      // als Ziel nicht - Klick wird ignoriert, der Modus bleibt aktiv, damit
      // der Nutzer stattdessen eine Verbindung anklicken kann.
      if (formatPainterClipboard) {
        if (formatPainterClipboard.kind === "shape") {
          const targets = selectedShapeIds.includes(shapeId) && selectedShapeIds.length > 1 ? selectedShapeIds : [shapeId];
          applyFormatPainterToShapes(targets);
          pushHistorySnapshot();
        }
        return;
      }

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
      // Gesperrte Shapes (Z-05) bleiben selektierbar (siehe Selektionslogik
      // unten, unverändert), aber draggingShapeId wird bewusst nicht gesetzt -
      // dadurch bleibt handleMouseMove's Drag-Zweig für sie inaktiv.
      draggingShapeId.current = shape.locked ? null : shapeId;
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
    [
      shapes,
      viewport,
      selectShape,
      getGroupMemberIds,
      selectShapes,
      updateShape,
      formatPainterClipboard,
      selectedShapeIds,
      applyFormatPainterToShapes,
    ]
  );

  // --- Resize starten (Z-01: an jedem der 8 Griffe) ---
  const handleResizeStart = useCallback((shapeId: string, direction: ResizeDirection, e: MouseEvent) => {
    const shape = useCanvasStore.getState().shapes[shapeId];
    if (!shape || shape.locked) return;
    resizingShapeId.current = shapeId;
    didResize.current = false;
    resizeStart.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      x: shape.position.x,
      y: shape.position.y,
      width: shape.size.width,
      height: shape.size.height,
      aspectRatio: shape.size.width / shape.size.height,
      direction,
    };
  }, []);

  // --- Mehrfachauswahl-Resize starten (Z-03): dieselben 8 Griffe, aber an
  //     der gemeinsamen Bounding-Box der Auswahl statt an einer Einzel-Shape. ---
  const handleGroupResizeStart = useCallback(
    (ids: string[], bbox: { x: number; y: number; width: number; height: number }, direction: ResizeDirection, e: MouseEvent) => {
      const originalGeometry: Record<string, { position: Point; size: Size }> = {};
      const currentShapes = useCanvasStore.getState().shapes;
      for (const id of ids) {
        const s = currentShapes[id];
        if (s) originalGeometry[id] = { position: { ...s.position }, size: { ...s.size } };
      }
      groupResizing.current = {
        ids,
        direction,
        mouseX: e.clientX,
        mouseY: e.clientY,
        bbox,
        aspectRatio: bbox.width / bbox.height,
        originalGeometry,
      };
      didGroupResize.current = false;
    },
    []
  );

  // --- Rotation starten (Ziehen am Dreh-Griff oberhalb der Shape) ---
  const handleRotateStart = useCallback(
    (shapeId: string, e: MouseEvent) => {
      const shape = useCanvasStore.getState().shapes[shapeId];
      if (!shape || shape.locked) return;
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const centerX = shape.position.x + shape.size.width / 2;
      const centerY = shape.position.y + shape.size.height / 2;
      const worldX = (e.clientX - rect.left - viewport.x) / viewport.zoom;
      const worldY = (e.clientY - rect.top - viewport.y) / viewport.zoom;
      const startAngle = (Math.atan2(worldY - centerY, worldX - centerX) * 180) / Math.PI;
      rotatingShapeId.current = shapeId;
      didRotate.current = false;
      rotateStart.current = { centerX, centerY, startAngle, startRotation: shape.style?.rotation ?? 0 };
    },
    [viewport]
  );

  // --- Wegpunkt hinzufügen (Ziehen an einer Linien-Segmentmitte) ---
  const handleAddWaypoint = useCallback(
    (connectorId: string, index: number, point: { x: number; y: number }) => {
      insertManualWaypoint(connectorId, index, point);
      draggingWaypoint.current = { connectorId, index };
    },
    [insertManualWaypoint]
  );

  // --- Wegpunkt sofort einfügen, ohne zu ziehen (Doppelklick, Z-10) ---
  const handleQuickInsertWaypoint = useCallback(
    (connectorId: string, index: number, point: { x: number; y: number }) => {
      insertManualWaypoint(connectorId, index, point);
      pushHistorySnapshot();
    },
    [insertManualWaypoint]
  );

  // --- Bestehenden Wegpunkt greifen ---
  const handleWaypointMouseDown = useCallback((connectorId: string, index: number, e: MouseEvent) => {
    e.stopPropagation();
    draggingWaypoint.current = { connectorId, index };
  }, []);

  // --- Verbinder-Label greifen: startet freies Verschieben (labelOffset) ---
  const handleLabelMouseDown = useCallback(
    (connectorId: string, e: MouseEvent) => {
      e.stopPropagation();
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const worldX = (e.clientX - rect.left - viewport.x) / viewport.zoom;
      const worldY = (e.clientY - rect.top - viewport.y) / viewport.zoom;
      const connector = connectors[connectorId];
      const startOffset = connector?.labelOffset ?? { x: 0, y: -6 };
      draggingLabel.current = { connectorId, startOffset, startWorldX: worldX, startWorldY: worldY };
    },
    [viewport, connectors]
  );

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
          selectShape(newShape.id);
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

      const id = `shape_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      addShape({
        id,
        type: shapeType,
        position,
        size: definition.defaultSize,
        data: { ...(definition.defaultData ?? {}) },
        zIndex: Object.keys(shapes).length,
        parentId,
      });
      // Frisch abgelegtes Element gleich auswaehlen: Sonst ist nach dem Ablegen
      // nichts selektiert, das Eigenschaften-Panel bleibt leer und
      // Kopieren/Loeschen/Ausrichten sind ausgegraut - der Nutzer muss das eben
      // erst platzierte Element zusaetzlich anklicken.
      selectShape(id);
      pushHistorySnapshot();
    },
    [viewport, addShape, selectShape, shapes]
  );

  // --- Rechtsklick-Kontextmenü: Shape ---
  const handleShapeContextMenu = useCallback(
    (e: MouseEvent, shapeId: string) => {
      e.preventDefault();
      e.stopPropagation();
      const state = useCanvasStore.getState();
      if (!state.selectedShapeIds.includes(shapeId)) {
        selectShape(shapeId, false);
      }
      const selection = useCanvasStore.getState().selectedShapeIds.includes(shapeId)
        ? useCanvasStore.getState().selectedShapeIds
        : [shapeId];
      const shape = state.shapes[shapeId];
      if (!shape) return;
      const definition = ShapeRegistry.get(shape.type);
      const canRotate = !shape.attachedToId && !definition?.isContainer;

      const sections: ContextMenuSection[] = [
        {
          items: [
            {
              label: "Duplizieren",
              onClick: () => {
                copySelectionToClipboard();
                pasteClipboard();
                pushHistorySnapshot();
              },
            },
            {
              label: "Löschen",
              onClick: () => {
                const s = useCanvasStore.getState();
                selection.forEach((id) => s.removeShape(id));
                pushHistorySnapshot();
              },
            },
          ],
        },
      ];

      // Gruppieren/Gruppierung aufheben: "Elemente gruppieren" nur bei
      // Mehrfachauswahl (groupShapes ignoriert ohnehin < 2 Elemente, siehe
      // Store), "Gruppierung aufheben" nur wenn das rechtsgeklickte Element
      // tatsächlich einer Gruppe angehört.
      const isGrouped = Boolean(shape.groupId);
      if (selection.length >= 2 || isGrouped) {
        const groupItems: ContextMenuSection["items"] = [];
        if (selection.length >= 2) {
          groupItems.push({
            label: "Elemente gruppieren",
            onClick: () => {
              groupShapes(selection);
              pushHistorySnapshot();
            },
          });
        }
        if (isGrouped) {
          groupItems.push({
            label: "Gruppierung aufheben",
            onClick: () => {
              ungroupShapes(selection);
              pushHistorySnapshot();
            },
          });
        }
        sections.push({ items: groupItems });
      }

      if (canRotate) {
        sections.push({
          items: [
            {
              label: "Um 90° drehen",
              onClick: () => {
                setShapeRotation(shapeId, (shape.style?.rotation ?? 0) + 90);
                pushHistorySnapshot();
              },
            },
            {
              label: "Rotation zurücksetzen",
              disabled: !shape.style?.rotation,
              onClick: () => {
                setShapeRotation(shapeId, 0);
                pushHistorySnapshot();
              },
            },
          ],
        });
      }

      if (selection.length >= 2) {
        const align = (mode: AlignMode) => () => {
          alignShapes(selection, mode);
          pushHistorySnapshot();
        };
        sections.push({
          items: [
            { label: "Links ausrichten", onClick: align("left") },
            { label: "Horizontal zentrieren", onClick: align("centerH") },
            { label: "Rechts ausrichten", onClick: align("right") },
            { label: "Oben ausrichten", onClick: align("top") },
            { label: "Vertikal zentrieren", onClick: align("middleV") },
            { label: "Unten ausrichten", onClick: align("bottom") },
          ],
        });
      }

      if (selection.length >= 3) {
        sections.push({
          items: [
            {
              label: "Horizontal verteilen",
              onClick: () => {
                distributeShapes(selection, "horizontal");
                pushHistorySnapshot();
              },
            },
            {
              label: "Vertikal verteilen",
              onClick: () => {
                distributeShapes(selection, "vertical");
                pushHistorySnapshot();
              },
            },
          ],
        });
      }

      // Größe angleichen (Z-13), bezogen auf das zuerst in `selection`
      // enthaltene Element (siehe matchShapeSizes-Dokumentation im Store).
      if (selection.length >= 2) {
        sections.push({
          items: [
            {
              label: "Breite angleichen",
              onClick: () => {
                matchShapeSizes(selection, "width");
                pushHistorySnapshot();
              },
            },
            {
              label: "Höhe angleichen",
              onClick: () => {
                matchShapeSizes(selection, "height");
                pushHistorySnapshot();
              },
            },
            {
              label: "Größe angleichen (beides)",
              onClick: () => {
                matchShapeSizes(selection, "both");
                pushHistorySnapshot();
              },
            },
          ],
        });
      }

      // Spiegeln (Z-04) - unabhängig von canRotate, da auch Container/
      // angeheftete Shapes theoretisch spiegelbar wären; Store filtert
      // angeheftete Shapes ohnehin selbst aus (siehe flipShapes).
      sections.push({
        items: [
          {
            label: "Horizontal spiegeln",
            disabled: shape.locked,
            onClick: () => {
              flipShapes(selection, "horizontal");
              pushHistorySnapshot();
            },
          },
          {
            label: "Vertikal spiegeln",
            disabled: shape.locked,
            onClick: () => {
              flipShapes(selection, "vertical");
              pushHistorySnapshot();
            },
          },
        ],
      });

      // Sperren/Ausblenden (Z-05).
      sections.push({
        items: [
          {
            label: shape.locked ? "Entsperren" : "Sperren",
            onClick: () => {
              selection.forEach((id) => setShapeLocked(id, !shape.locked));
              pushHistorySnapshot();
            },
          },
          {
            label: "Ausblenden",
            onClick: () => {
              selection.forEach((id) => setShapeHidden(id, true));
              pushHistorySnapshot();
            },
          },
        ],
      });

      // Formatpinsel (Z-14) auch im Kontextmenü erreichbar - "Format
      // kopieren" bezieht sich bewusst auf die RECHTSGEKLICKTE Shape (nicht
      // die erste der Selektion, anders als der Toolbar-Button), das ist
      // beim Rechtsklick auf ein konkretes Element eindeutiger. "Format hier
      // einfügen" erscheint nur, wenn gerade ein Stil kopiert ist, und ist
      // deaktiviert (nicht versteckt), falls dieser von einer Verbindung statt
      // einer Shape stammt - macht sichtbar, dass ein Formatpinsel aktiv ist,
      // aber gerade nicht zu diesem Zieltyp passt.
      const formatItems: ContextMenuSection["items"] = [
        {
          label: "Format kopieren",
          onClick: () => copyFormatFromShape(shapeId),
        },
      ];
      if (formatPainterClipboard) {
        formatItems.push({
          label: "Format hier einfügen",
          disabled: formatPainterClipboard.kind !== "shape",
          onClick: () => {
            applyFormatPainterToShapes(selection);
            pushHistorySnapshot();
          },
        });
      }
      sections.push({ items: formatItems });

      setContextMenu({ x: e.clientX, y: e.clientY, sections });
    },
    [
      selectShape,
      setShapeRotation,
      alignShapes,
      distributeShapes,
      matchShapeSizes,
      flipShapes,
      setShapeLocked,
      setShapeHidden,
      copyFormatFromShape,
      formatPainterClipboard,
      applyFormatPainterToShapes,
      groupShapes,
      ungroupShapes,
    ]
  );

  // --- Rechtsklick-Kontextmenü: Verbindung ---
  const handleConnectorContextMenu = useCallback(
    (connectorId: string, e: MouseEvent) => {
      e.preventDefault();
      selectConnector(connectorId);
      const connector = useCanvasStore.getState().connectors[connectorId];
      const hasManual = Boolean(connector?.manualWaypoints && connector.manualWaypoints.length > 0);
      const availableTypes = ConnectorTypeRegistry.getAll();

      const sections: ContextMenuSection[] = [
        {
          items: [
            {
              label: "Löschen",
              onClick: () => {
                removeConnector(connectorId);
                pushHistorySnapshot();
              },
            },
            {
              label: "Wegpunkte zurücksetzen (Auto-Routing)",
              disabled: !hasManual,
              onClick: () => {
                const count = connector?.manualWaypoints?.length ?? 0;
                for (let i = 0; i < count; i++) removeManualWaypoint(connectorId, 0);
                pushHistorySnapshot();
              },
            },
          ],
        },
      ];

      if (availableTypes.length > 1) {
        sections.push({
          items: availableTypes.map((t) => ({
            label: t.label,
            disabled: connector?.connectorType === t.type,
            onClick: () => {
              useCanvasStore.getState().setConnectorType(connectorId, t.type);
              pushHistorySnapshot();
            },
          })),
        });
      }

      // Formatpinsel (Z-14) auch für Verbindungen im Kontextmenü - siehe
      // analoge Begründung in handleShapeContextMenu.
      const formatItems: ContextMenuSection["items"] = [
        {
          label: "Format kopieren",
          onClick: () => copyFormatFromConnector(connectorId),
        },
      ];
      if (formatPainterClipboard) {
        formatItems.push({
          label: "Format hier einfügen",
          disabled: formatPainterClipboard.kind !== "connector",
          onClick: () => {
            applyFormatPainterToConnectors([connectorId]);
            pushHistorySnapshot();
          },
        });
      }
      sections.push({ items: formatItems });

      setContextMenu({ x: e.clientX, y: e.clientY, sections });
    },
    [
      selectConnector,
      removeConnector,
      removeManualWaypoint,
      copyFormatFromConnector,
      formatPainterClipboard,
      applyFormatPainterToConnectors,
    ]
  );

  // --- Rechtsklick-Kontextmenü: leere Fläche ---
  const handleCanvasContextMenu = useCallback(
    (e: MouseEvent<SVGSVGElement>) => {
      e.preventDefault();
      const hasHidden = Object.values(useCanvasStore.getState().shapes).some((s) => s.hidden);
      const sections: ContextMenuSection[] = [
        {
          items: [
            {
              label: "Einfügen",
              disabled: !hasClipboardContent(),
              onClick: () => {
                pasteClipboard();
                pushHistorySnapshot();
              },
            },
            {
              label: "Alle auswählen",
              onClick: () => selectShapes(Object.keys(useCanvasStore.getState().shapes)),
            },
          ],
        },
        {
          items: [
            { label: "An Fenster anpassen", onClick: () => zoomToFit() },
            {
              label: "Auswahl zoomen",
              disabled: useCanvasStore.getState().selectedShapeIds.length === 0,
              onClick: () => zoomToSelection(),
            },
            {
              label: "Zoom zurücksetzen",
              onClick: () => setViewport({ zoom: 1, x: 0, y: 0 }),
            },
          ],
        },
        {
          items: [
            {
              label: showPagePreview ? "Druckseiten-Vorschau ausblenden" : "Druckseiten-Vorschau anzeigen",
              onClick: () => togglePagePreview(),
            },
            {
              label: "Alle ausgeblendeten Elemente einblenden",
              disabled: !hasHidden,
              onClick: () => {
                unhideAllShapes();
                pushHistorySnapshot();
              },
            },
          ],
        },
      ];
      setContextMenu({ x: e.clientX, y: e.clientY, sections });
    },
    [selectShapes, setViewport, zoomToFit, zoomToSelection, showPagePreview, togglePagePreview, unhideAllShapes]
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
    <div ref={containerRef} className="canvas-container" style={{ width: "100%", height: "100%", overflow: "hidden", position: "relative" }}>
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        style={{ cursor, background: "var(--canvas-bg, #fafafa)" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onContextMenu={handleCanvasContextMenu}
      >
        <GridLayer viewport={viewport} gridSize={gridSize} />

        <g transform={`translate(${viewport.x} ${viewport.y}) scale(${viewport.zoom})`}>
          <ConnectorLayer
            shapes={shapes}
            connectors={connectors}
            connectorDraft={connectorDraft}
            reconnectDraft={reconnectDraft}
            selectedConnectorId={selectedConnectorId}
            onSelectConnector={handleConnectorMouseDown}
            onDoubleClickConnector={handleConnectorDoubleClick}
            onContextMenuConnector={handleConnectorContextMenu}
            onAddWaypoint={handleAddWaypoint}
            onQuickInsertWaypoint={handleQuickInsertWaypoint}
            onWaypointMouseDown={handleWaypointMouseDown}
            onWaypointDoubleClick={handleWaypointDoubleClick}
            onLabelMouseDown={handleLabelMouseDown}
            useRouting={!isBulkDragging}
          />

          {sortedShapes.map((shape) => {
            if (shape.hidden) return null; // Z-05: ausgeblendete Shapes werden gar nicht gerendert
            if (!isShapeVisible(shape)) return null;
            const definition = ShapeRegistry.get(shape.type);
            if (!definition) return null;
            const ShapeComponent = definition.render;
            const showPorts = hoveredShapeId === shape.id || isDraggingConnector.current;
            const showHoverArrows =
              hoveredShapeId === shape.id &&
              !isDraggingConnector.current &&
              !shape.attachedToId &&
              !definition.isContainer &&
              !formatPainterClipboard;
            const isSelected = selectedShapeIds.includes(shape.id);
            const rotation = shape.style?.rotation ?? 0;
            const canRotate = !shape.attachedToId && !definition.isContainer && !shape.locked;
            const canResize = !shape.attachedToId && !shape.locked;
            const centerX = shape.position.x + shape.size.width / 2;
            const centerY = shape.position.y + shape.size.height / 2;
            // Rotation + Spiegelung (Z-04) kombiniert als eine Transform-Kette:
            // erst spiegeln, dann rotieren, beides um den Shape-Mittelpunkt -
            // rein generisch, kein Modul-Wissen nötig (siehe ShapeStyle).
            const flipX = shape.style?.flipX ?? false;
            const flipY = shape.style?.flipY ?? false;
            const transformParts: string[] = [];
            if (rotation) transformParts.push(`rotate(${rotation} ${centerX} ${centerY})`);
            if (flipX || flipY) {
              transformParts.push(`translate(${centerX} ${centerY}) scale(${flipX ? -1 : 1} ${flipY ? -1 : 1}) translate(${-centerX} ${-centerY})`);
            }
            const shapeTransform = transformParts.length > 0 ? transformParts.join(" ") : undefined;
            // Opacity/Schatten (Z-15) - generisch am Wrapper angewendet, betrifft
            // bewusst nicht die Resize-/Rotier-Griffe (die sitzen außerhalb
            // dieser <g>, siehe Struktur unten).
            const opacity = shape.style?.opacity ?? 1;
            const shadowFilter = shape.style?.shadow ? "drop-shadow(2px 3px 4px rgba(0,0,0,0.35))" : undefined;

            return (
              <g
                key={shape.id}
                /* Stabile Kennung fuer automatisierte Pruefungen: Ohne sie
                   muessen Testskripte Elemente ueber Position/Reihenfolge
                   raten, was schon zu falschen Messwerten gefuehrt hat.
                   Reine Diagnose-Attribute - die App liest sie nie. */
                data-shape-id={shape.id}
                data-shape-type={shape.type}
                onMouseDown={(e) => handleShapeMouseDown(e, shape.id)}
                onDoubleClick={(e) => handleShapeDoubleClick(e, shape.id)}
                onContextMenu={(e) => handleShapeContextMenu(e, shape.id)}
                onMouseEnter={() => setHoveredShape(shape.id)}
                onMouseLeave={() => setHoveredShape(null)}
                style={{
                  cursor: formatPainterClipboard
                    ? formatPainterClipboard.kind === "shape"
                      ? "copy"
                      : "not-allowed"
                    : shape.locked
                      ? "default"
                      : "move",
                }}
              >
                <g transform={shapeTransform} style={{ opacity, filter: shadowFilter }}>
                  {/* Unsichtbare, aber "gemalte" (fill="transparent" statt "none")
                      Trefferfläche über der GESAMTEN deklarierten Shape-Größe.
                      Nötig, weil SVG-Klicks nur auf tatsächlich gefüllten/
                      gestrichenen Pixeln registriert werden: Shapes mit
                      durchgehender Füllung (die meisten BPMN-Formen) waren davon
                      nie betroffen, aber die bewusst ungefüllten, nur konturierten
                      Wireframe-Formen (Rough.js-Skizzenstil) ließen sich vorher
                      nur exakt auf der wackligen Kontur selbst anklicken - kaum
                      treffbar. Analog zum bereits bestehenden Muster für
                      Verbindungen (ConnectorLayer.tsx, breiter transparenter
                      Hit-Pfad). */}
                  <rect
                    x={shape.position.x}
                    y={shape.position.y}
                    width={shape.size.width}
                    height={shape.size.height}
                    fill="transparent"
                  />
                  <ShapeComponent shape={shape} isSelected={isSelected} />
                  {shape.locked && (
                    <text x={shape.position.x + 3} y={shape.position.y + 14} fontSize={12} style={{ pointerEvents: "none", userSelect: "none" }}>
                      🔒
                    </text>
                  )}
                  {isSelected && canRotate && (
                    <RotateHandle
                      x={centerX}
                      y={shape.position.y - 22}
                      anchorY={shape.position.y}
                      onRotateStart={(e) => handleRotateStart(shape.id, e)}
                      onResetRotation={() => {
                        setShapeRotation(shape.id, 0);
                        pushHistorySnapshot();
                      }}
                    />
                  )}
                </g>
                <g transform={`translate(${shape.position.x} ${shape.position.y})`}>
                  {/* Reihenfolge ist hier Bedienlogik, keine Kosmetik (F-11):
                      Die "Brücken"-Rechtecke der Hover-Pfeile reichen vom
                      Shape-Rand bis zum jeweiligen Pfeil (18 px) und liegen
                      damit genau über der äußeren Hälfte der Ports. Standen
                      sie - wie zuvor - WEITER HINTEN im DOM, gewannen sie den
                      Treffertest: Ein Klick auf den sichtbar gezeichneten Port
                      verschob das Element, statt eine Verbindung zu beginnen.
                      Deshalb zuerst die Pfeile, dann die Ports, dann die
                      Resize-Griffe - vom schwächsten zum stärksten Anspruch. */}
                  <HoverArrows
                    shape={shape}
                    visible={showHoverArrows}
                    onArrowMouseDown={(direction, e) => handleHoverArrowMouseDown(shape.id, direction, e)}
                  />
                  <ShapePorts
                    shape={shape}
                    visible={showPorts}
                    onPortMouseDown={(portId, e) => handlePortMouseDown(shape.id, portId, e)}
                  />
                  {isSelected && canResize && selectedShapeIds.length <= 1 && (
                    <ResizeHandle
                      width={shape.size.width}
                      height={shape.size.height}
                      onResizeStart={(direction, e) => handleResizeStart(shape.id, direction, e)}
                    />
                  )}
                </g>
              </g>
            );
          })}

          {/* Endpunkt-Griffe der ausgewählten Verbindung - bewusst NACH den
              Shapes, damit sie über deren Trefferfläche und Ports liegen
              (siehe ConnectorEndpointHandles in ConnectorLayer.tsx). */}
          {selectedConnectorId && !reconnectDraft && connectors[selectedConnectorId] && (
            <ConnectorEndpointHandles
              connector={connectors[selectedConnectorId]}
              shapes={shapes}
              onEndpointMouseDown={handleEndpointMouseDown}
            />
          )}

          {/* Mehrfachauswahl-Resize (Z-03): eigene 8 Griffe an der
              gemeinsamen Bounding-Box, statt an jeder Einzel-Shape. Nur
              gerendert, wenn mindestens 2 nicht angeheftete Shapes selektiert
              sind (sonst identisch zum Einzel-Resize oben). */}
          {(() => {
            if (selectedShapeIds.length <= 1) return null;
            const targets = selectedShapeIds.map((id) => shapes[id]).filter((s): s is ShapeInstance => Boolean(s) && !s.attachedToId);
            if (targets.length < 2) return null;
            const minX = Math.min(...targets.map((s) => s.position.x));
            const minY = Math.min(...targets.map((s) => s.position.y));
            const maxX = Math.max(...targets.map((s) => s.position.x + s.size.width));
            const maxY = Math.max(...targets.map((s) => s.position.y + s.size.height));
            const bbox = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
            return (
              <g transform={`translate(${bbox.x} ${bbox.y})`}>
                <rect
                  x={0}
                  y={0}
                  width={bbox.width}
                  height={bbox.height}
                  fill="none"
                  stroke="var(--accent, #3d5a99)"
                  strokeWidth={1}
                  strokeDasharray="5 3"
                  style={{ pointerEvents: "none" }}
                />
                <ResizeHandle
                  width={bbox.width}
                  height={bbox.height}
                  onResizeStart={(direction, e) => handleGroupResizeStart(targets.map((s) => s.id), bbox, direction, e)}
                />
              </g>
            );
          })()}

          <AlignmentGuidesLayer guides={alignmentGuides} />

          {/* Lineal-Hilfslinien (Z-17): persistente, verschiebbare Linien.
              Ziehen verschiebt sie live (moveGuide), Doppelklick entfernt sie.
              Bewusst per eigenem window-Listener gelöst (wie in Rulers.tsx),
              nicht über die drei zentralen CanvasEngine-Handler. */}
          {persistedGuides.map((g) => (
            <line
              key={g.id}
              x1={g.axis === "vertical" ? g.position : -100000}
              y1={g.axis === "horizontal" ? g.position : -100000}
              x2={g.axis === "vertical" ? g.position : 100000}
              y2={g.axis === "horizontal" ? g.position : 100000}
              stroke="var(--purple, #a35cff)"
              strokeWidth={1 / viewport.zoom}
              strokeDasharray={`${4 / viewport.zoom} ${3 / viewport.zoom}`}
              style={{ cursor: g.axis === "horizontal" ? "ns-resize" : "ew-resize" }}
              onMouseDown={(e) => {
                e.stopPropagation();
                const handleMove = (moveEvent: globalThis.MouseEvent) => {
                  const rect = svgRef.current?.getBoundingClientRect();
                  if (!rect) return;
                  const pos =
                    g.axis === "horizontal"
                      ? (moveEvent.clientY - rect.top - viewport.y) / viewport.zoom
                      : (moveEvent.clientX - rect.left - viewport.x) / viewport.zoom;
                  moveGuide(g.id, pos);
                };
                const handleUp = () => {
                  window.removeEventListener("mousemove", handleMove);
                  window.removeEventListener("mouseup", handleUp);
                };
                window.addEventListener("mousemove", handleMove);
                window.addEventListener("mouseup", handleUp);
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                removeGuide(g.id);
              }}
            />
          ))}

          {/* Druckseiten-Vorschau (Z-18): gestrichelte A4-Seitenränder auf der
              sonst unendlichen Zeichenfläche, rein optisch (kein Export-Bezug -
              das Lastenheft grenzt Export-Formate explizit aus, siehe
              Abschnitt 1 des Lastenhefts). Deckt mindestens die Bounding-Box
              aller Shapes ab, mindestens aber eine Seite ab Ursprung. */}
          {showPagePreview && (() => {
            const list = Object.values(shapes);
            const maxX = list.length > 0 ? Math.max(...list.map((s) => s.position.x + s.size.width), PAGE_SIZE.width) : PAGE_SIZE.width;
            const maxY = list.length > 0 ? Math.max(...list.map((s) => s.position.y + s.size.height), PAGE_SIZE.height) : PAGE_SIZE.height;
            const cols = Math.max(1, Math.ceil(maxX / PAGE_SIZE.width));
            const rows = Math.max(1, Math.ceil(maxY / PAGE_SIZE.height));
            const pages: React.ReactNode[] = [];
            for (let col = 0; col < cols; col++) {
              for (let row = 0; row < rows; row++) {
                pages.push(
                  <rect
                    key={`page-${col}-${row}`}
                    x={col * PAGE_SIZE.width}
                    y={row * PAGE_SIZE.height}
                    width={PAGE_SIZE.width}
                    height={PAGE_SIZE.height}
                    fill="none"
                    stroke="#9a9a9a"
                    strokeWidth={1 / viewport.zoom}
                    strokeDasharray={`${6 / viewport.zoom} ${4 / viewport.zoom}`}
                    style={{ pointerEvents: "none" }}
                  />
                );
              }
            }
            return <g>{pages}</g>;
          })()}

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
            const offset = connector.labelOffset ?? { x: 0, y: -6 };
            const midX = (sourceShape.position.x + targetShape.position.x) / 2 + offset.x;
            const midY = (sourceShape.position.y + targetShape.position.y) / 2 + offset.y;
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
      <Rulers viewport={viewport} containerRef={containerRef} />
      {contextMenu && (
        <ContextMenu x={contextMenu.x} y={contextMenu.y} sections={contextMenu.sections} onClose={closeContextMenu} />
      )}
    </div>
  );
}
