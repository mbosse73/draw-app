# bpmn-editor-source

Das Quellprojekt der App (Vite 8, React 19, TypeScript, Zustand 5). Das Build-Ergebnis
`dist/index.html` ist das komplette Deliverable — eine einzige, offline lauffähige
HTML-Datei, die als `../index.html` ausgeliefert wird.

```bash
npm install
npm run dev            # Dev-Server, http://localhost:5173
npm run build          # Produktions-Build -> dist/index.html
npm run lint           # Oxlint
npm run check:export   # alle Shape-Typen: Bildschirm gegen SVG-Export, pixelweise
npm run verify         # lint + build + check:export
npm run artefakt       # dist/index.html -> ../index.html (mit Prüfsummen-Bestätigung)
npm run ship           # verify + artefakt
```

Architektur, Entwurfsentscheidungen und Stolperfallen stehen in `../CLAUDE.md`.
Kurzfassung der beiden wichtigsten Regeln:

- `src/core/` darf nichts über ein Modul unter `src/modules/` wissen.
- Die Optik jedes Shapes existiert mehrfach (React-Komponente, `io/staticSvg.ts` des
  Moduls, `ToolboxIcon.tsx`, ggf. `bpmnXmlExport.ts`). `npm run check:export` findet
  Abweichungen, die sonst niemand bemerkt.
