/**
 * Erzeugt eine kleine SVG-Vorschau für die Toolbox, die optisch der echten
 * Zeichenfläche-Form entspricht (Kreis für Events, Raute für Gateways, etc.).
 * Bewusst als eigenständige, leichte Vorschau getrennt vom echten Shape-Renderer,
 * da die Toolbox-Kachel andere Proportionen (klein, fix, ohne Ports) braucht.
 */
export function ToolboxIcon({ shapeType }: { shapeType: string }) {
  const stroke = "#454d5a";
  const size = 28;

  // Kleines Trigger-Symbol (Uhr/Umschlag/Blitz), wiederverwendet für normale
  // und Boundary-Events. Erkennt den Trigger-Teil am Ende des Typ-Strings,
  // z.B. "bpmn.event.start.timer" -> "timer", "bpmn.boundaryEvent.error" -> "error".
  function TriggerMark({ trigger, cx, cy }: { trigger: string | undefined; cx: number; cy: number }) {
    if (trigger === "timer") {
      return (
        <g stroke={stroke} strokeWidth={1} fill="none">
          <circle cx={cx} cy={cy} r={4.5} />
          <line x1={cx} y1={cy} x2={cx} y2={cy - 2.8} />
          <line x1={cx} y1={cy} x2={cx + 2} y2={cy} />
        </g>
      );
    }
    if (trigger === "message") {
      return (
        <g stroke={stroke} strokeWidth={0.9} fill="none">
          <rect x={cx - 4} y={cy - 2.6} width={8} height={5.2} />
          <path d={`M ${cx - 4} ${cy - 2.6} L ${cx} ${cy} L ${cx + 4} ${cy - 2.6}`} />
        </g>
      );
    }
    if (trigger === "error") {
      return (
        <path
          d={`M ${cx - 3} ${cy + 4} L ${cx - 0.5} ${cy - 1} L ${cx + 1.3} ${cy + 1.3} L ${cx + 3.5} ${cy - 4.5}`}
          stroke={stroke}
          strokeWidth={1.2}
          fill="none"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      );
    }
    return null;
  }

  // Normale Events: bpmn.event.<kind> oder bpmn.event.<kind>.<trigger>
  if (shapeType.startsWith("bpmn.event.")) {
    const parts = shapeType.split(".");
    const kind = parts[2]; // "start" | "intermediate" | "end"
    const trigger = parts[3]; // "timer" | "message" | "error" | undefined
    const isEnd = kind === "end";
    const isIntermediate = kind === "intermediate";
    return (
      <svg width={size} height={size} viewBox="0 0 28 28">
        <circle cx={14} cy={14} r={isEnd ? 10.5 : 11} fill="#fff" stroke={stroke} strokeWidth={isEnd ? 3 : 1.8} />
        {isIntermediate && <circle cx={14} cy={14} r={7.5} fill="none" stroke={stroke} strokeWidth={1.3} />}
        <TriggerMark trigger={trigger} cx={14} cy={14} />
      </svg>
    );
  }

  // Boundary Events: bpmn.boundaryEvent.<trigger> - Doppelkreis wie am Task-Rand
  if (shapeType.startsWith("bpmn.boundaryEvent.")) {
    const trigger = shapeType.split(".")[1];
    return (
      <svg width={size} height={size} viewBox="0 0 28 28">
        <circle cx={14} cy={14} r={10.5} fill="#fff" stroke={stroke} strokeWidth={1.6} />
        <circle cx={14} cy={14} r={7.5} fill="none" stroke={stroke} strokeWidth={1} />
        <TriggerMark trigger={trigger} cx={14} cy={14} />
      </svg>
    );
  }

  if (shapeType.startsWith("bpmn.task.")) {
    const isPlain = shapeType === "bpmn.task.none";
    return (
      <svg width={size} height={size} viewBox="0 0 28 28">
        <rect x={2} y={5} width={24} height={18} rx={3.5} fill="#f5f8fc" stroke={stroke} strokeWidth={1.5} />
        {!isPlain && <line x1={6} y1={9} x2={12} y2={9} stroke={stroke} strokeWidth={1.2} opacity={0.6} />}
      </svg>
    );
  }

  // Sub-Prozess: wie ein Task, aber mit kleinem +/- Symbol unten mittig als Hinweis
  if (shapeType === "bpmn.subProcess") {
    return (
      <svg width={size} height={size} viewBox="0 0 28 28">
        <rect x={2} y={5} width={24} height={18} rx={3.5} fill="#f5f8fc" stroke={stroke} strokeWidth={1.5} />
        <rect x={11} y={17} width={6} height={6} rx={1} fill="#fff" stroke={stroke} strokeWidth={1} />
        <line x1={12.5} y1={20} x2={15.5} y2={20} stroke={stroke} strokeWidth={1} />
        <line x1={14} y1={18.5} x2={14} y2={21.5} stroke={stroke} strokeWidth={1} />
      </svg>
    );
  }

  if (shapeType.startsWith("bpmn.gateway.")) {
    const kind = shapeType.split(".").pop();
    return (
      <svg width={size} height={size} viewBox="0 0 28 28">
        <polygon points="14,2 26,14 14,26 2,14" fill="#fff" stroke={stroke} strokeWidth={1.5} />
        {kind === "exclusive" && (
          <g stroke={stroke} strokeWidth={2}>
            <line x1={10.5} y1={10.5} x2={17.5} y2={17.5} />
            <line x1={17.5} y1={10.5} x2={10.5} y2={17.5} />
          </g>
        )}
        {kind === "parallel" && (
          <g stroke={stroke} strokeWidth={2}>
            <line x1={14} y1={9} x2={14} y2={19} />
            <line x1={9} y1={14} x2={19} y2={14} />
          </g>
        )}
        {kind === "inclusive" && <circle cx={14} cy={14} r={5} fill="none" stroke={stroke} strokeWidth={2} />}
        {/* kind === "none": bewusst kein Symbol - einfaches Gateway */}
      </svg>
    );
  }

  if (shapeType === "bpmn.dataObject") {
    return (
      <svg width={size} height={size} viewBox="0 0 28 28">
        <path d="M 6 3 L 18 3 L 22 7 L 22 25 L 6 25 Z" fill="#fff" stroke={stroke} strokeWidth={1.5} />
        <path d="M 18 3 L 18 7 L 22 7" fill="none" stroke={stroke} strokeWidth={1.5} />
      </svg>
    );
  }

  // Pool UND Lane: beide sind Container mit seitlichem Titel-Band.
  if (shapeType === "bpmn.pool" || shapeType === "bpmn.lane") {
    return (
      <svg width={size} height={size} viewBox="0 0 28 28">
        <rect x={2} y={4} width={24} height={20} fill="#fff" stroke={stroke} strokeWidth={1.5} />
        <line x1={8} y1={4} x2={8} y2={24} stroke={stroke} strokeWidth={1.5} />
      </svg>
    );
  }

  // Text-Element: Buchstabe "T" als Platzhalter-Symbol, deutet freien Text an
  if (shapeType === "text.label") {
    return (
      <svg width={size} height={size} viewBox="0 0 28 28">
        <line x1={7} y1={7} x2={21} y2={7} stroke={stroke} strokeWidth={1.8} />
        <line x1={14} y1={7} x2={14} y2={21} stroke={stroke} strokeWidth={1.8} />
      </svg>
    );
  }

  // Fallback: einfaches Rechteck
  return (
    <svg width={size} height={size} viewBox="0 0 28 28">
      <rect x={3} y={6} width={22} height={16} rx={2} fill="#fff" stroke={stroke} strokeWidth={1.5} />
    </svg>
  );
}
