// Generisches Shape-Modell der Core-Engine.
// WICHTIG: Diese Datei darf NIEMALS etwas BPMN-Spezifisches enthalten.
// Alle BPMN-Details leben in src/modules/bpmn/.

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

/** Ein Verbindungspunkt (Port) an dem Konnektoren andocken können. */
export interface Port {
  id: string;
  /** Relative Position innerhalb der Shape, 0..1 (z.B. 0.5/0 = oben mittig) */
  relativePosition: Point;
}

/**
 * Generische, rein visuelle Zusatz-Attribute einer Shape-Instanz. Bewusst
 * getrennt vom fachlichen `data`-Feld (das ist Sache der Module) - hier
 * landet nur, was jede Shape unabhängig von ihrem Typ betreffen kann.
 */
export interface ShapeStyle {
  /** Rotation in Grad (0-359, im Uhrzeigersinn) um den Shape-Mittelpunkt.
   *  Nur für nicht-container, nicht-angeheftete Shapes sinnvoll - siehe
   *  Anwendungsstellen in CanvasEngine.tsx/imageExport.ts. */
  rotation?: number;
  /** Horizontale/vertikale Spiegelung um den Shape-Mittelpunkt (Z-04). Rein
   *  generisch (SVG scale(-1,1)/scale(1,-1) um die Mitte), angewendet in
   *  CanvasEngine.tsx zusammen mit der Rotation - kein Modul-Wissen nötig. */
  flipX?: boolean;
  flipY?: boolean;
  /** Generische visuelle Overrides (Z-15, "Stil-Panel"), unabhängig von
   *  fachlichen BPMN-Feldern. Werden von CanvasEngine.tsx generisch als
   *  Opacity/Schatten angewendet (fillColor/strokeColor/strokeWidth/dashStyle
   *  müssen vom jeweiligen Modul-Shape selbst konsumiert werden, siehe
   *  modules/bpmn/shapes/constants.ts `resolveFill`/`resolveStroke`/...). */
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  dashStyle?: "solid" | "dashed" | "dotted";
  /** 0..1, Default 1 (voll deckend). */
  opacity?: number;
  shadow?: boolean;
}

/**
 * Die generische Repräsentation eines Elements auf der Zeichenfläche.
 * `type` verweist auf ein registriertes Modul (z.B. "bpmn.task.user"),
 * die Core-Engine interpretiert diesen String nicht selbst.
 */
export interface ShapeInstance {
  id: string;
  type: string;
  position: Point;
  size: Size;
  /** Freies Datenfeld, dessen Struktur vom jeweiligen Modul definiert wird */
  data: Record<string, unknown>;
  parentId?: string; // z.B. für Elemente innerhalb einer Lane
  /** Gemeinsame Gruppen-ID (Strg+G): Klick auf ein Gruppenmitglied selektiert die ganze Gruppe. */
  groupId?: string;
  /** Für an ein anderes Element angeheftete Shapes (z.B. BPMN Boundary Events):
   *  ID der Host-Shape, an deren Rand diese Shape "klebt" und sich mitbewegt. */
  attachedToId?: string;
  /** Relative Position am Rand der Host-Shape (0..1 im Uhrzeigersinn um den
   *  Umfang, 0 = oben mittig), nur relevant wenn attachedToId gesetzt ist. */
  attachmentRatio?: number;
  zIndex: number;
  /** Optionale generische Visual-Overrides (Rotation, Spiegelung, Stil-Panel-Felder). */
  style?: ShapeStyle;
  /** Sperrt Position/Größe/Rotation (Z-05). Shape bleibt sicht- und selektierbar
   *  (zum Entsperren), Drag/Resize/Rotate/Pfeiltasten-Nudge/Löschen werden in
   *  CanvasEngine.tsx dafür generisch übersprungen. */
  locked?: boolean;
  /** Blendet die Shape aus dem Rendering aus (Z-05). Über das Kontextmenü der
   *  leeren Fläche ("Alle einblenden") wieder sichtbar zu machen. */
  hidden?: boolean;
}

/**
 * Generische Verbindungstypen (Core-Engine-Ebene). BPMN-spezifische Namen
 * (Sequenzfluss/Nachrichtenfluss/Assoziation) werden im BPMN-Modul auf diese
 * generischen Stile gemappt, damit die Engine kein BPMN-Wissen braucht.
 */
export type ConnectorLineStyle = "solid" | "dashed" | "dotted";

/** Generische Pfeilspitzen-Varianten für Verbindungsenden. */
export type ArrowHeadStyle = "none" | "arrow" | "diamond" | "circle";

/**
 * Optionale Nutzer-Overrides für die Darstellung einer einzelnen Verbindung,
 * unabhängig von deren `connectorType`-Vorgabe (siehe ConnectorTypeRegistry).
 * Nicht gesetzte Felder fallen auf die Vorgabe des Verbindungstyps zurück.
 */
/** Verbindungs-Routingstil (Z-08): wie der Pfad zwischen Wegpunkten gezeichnet
 *  wird. "orthogonal" ist der bisherige Standard (A-Stern-Routing/Fallback,
 *  siehe pathRouting.ts). "straight" ignoriert Routing komplett (direkte Linie).
 *  "curved" nutzt dieselben Wegpunkte, rendert sie aber als sanfte Kurve
 *  statt scharfer Ecken. "stepped" ist ein einzelner Knick auf halber
 *  Strecke (Entity-Relation-Stil). Manuelle Wegpunkte haben in jedem Stil
 *  weiterhin Vorrang (siehe computeConnectorPath). */
export type ConnectorPathStyle = "orthogonal" | "straight" | "curved" | "stepped";

export interface ConnectorStyle {
  lineStyle?: ConnectorLineStyle;
  startArrow?: ArrowHeadStyle;
  endArrow?: ArrowHeadStyle;
  pathStyle?: ConnectorPathStyle;
}

export interface ConnectorInstance {
  id: string;
  sourceShapeId: string;
  sourcePortId: string;
  targetShapeId: string;
  targetPortId: string;
  label?: string;
  /** Manueller Versatz (Weltkoordinaten) des Labels gegenüber seiner automatischen
   *  Default-Position (Verbindungsmittelpunkt). Erlaubt freies Verschieben des Labels
   *  per Drag, ohne dass es seine Zugehörigkeit zum Verbinder verliert - wird beim
   *  Verschieben/Neu-Routen des Verbinders beibehalten (relativ, nicht absolut). */
  labelOffset?: Point;
  /** z.B. "bpmn.sequenceFlow" | "bpmn.messageFlow" | "bpmn.association" - vom jeweiligen Modul definiert */
  connectorType?: string;
  /** Vom Nutzer manuell gesetzte Zwischenpunkte (Weltkoordinaten). Wenn vorhanden,
   *  hat der Nutzer die Kontrolle über den Pfad übernommen - kein automatisches
   *  Routing mehr, bis die Wegpunkte wieder gelöscht werden. */
  manualWaypoints?: Point[];
  waypoints: Point[]; // zuletzt berechneter/genutzter Pfad (Cache, wird neu berechnet)
  /** Optionale Overrides für Linienstil/Pfeilspitzen (siehe ConnectorStyle). */
  style?: ConnectorStyle;
}

/**
 * Das Interface, das jedes Shape-Modul implementieren muss, um sich
 * bei der ShapeRegistry zu registrieren (Plugin-Mechanismus, Kap. 4).
 */
export interface ShapeDefinition {
  type: string;
  /** Übergeordnete Hierarchieebene in der Toolbox (z.B. "BPMN 2.0"). Muss von
   *  jedem Modul gesetzt werden; die Core-Engine interpretiert den Wert nicht,
   *  sondern nutzt ihn nur zur Gruppierung/Anzeige in der Toolbox. */
  drawingType: string;
  category: string; // z.B. "Events", "Tasks", "Gateways" für die Toolbox-Gruppierung
  label: string;
  defaultSize: Size;
  ports: Port[];
  icon?: string;
  /** Wird beim Platzieren aus der Toolbox in shape.data kopiert (z.B. { eventType: "start" }) */
  defaultData?: Record<string, unknown>;
  /** Markiert Container-Shapes (z.B. Pool/Lane): können andere Elemente aufnehmen (parentId),
   *  werden immer unterhalb ihrer Kinder gerendert, und sind größenveränderlich. */
  isContainer?: boolean;
  /** Für auf-/zuklappbare Container (z.B. Sub-Prozess): Größen für den jeweiligen
   *  Zustand. Wenn gesetzt, kann shape.data.expanded (boolean) den Zustand steuern -
   *  die Core-Engine kennt dabei nur diese generischen Größen, kein BPMN-Wissen. */
  collapsedSize?: Size;
  expandedSize?: Size;
  /** Markiert Shapes, die sich beim Ablegen über einer anderen (nicht-Container-)
   *  Shape automatisch an deren Rand anheften (z.B. BPMN Boundary Event). */
  isAttachable?: boolean;
  /** React-Komponente, die die Shape auf dem Canvas rendert */
  render: React.ComponentType<ShapeRenderProps>;
}

export interface ShapeRenderProps {
  shape: ShapeInstance;
  isSelected: boolean;
}
