# draw-app

Ein browserbasierter, **vollständig offline** laufender BPMN-2.0-Diagrammeditor mit
einem zweiten Modul für Desktop-Wireframes. Kein Server, keine Installation, kein
Netzwerkzugriff zur Laufzeit.

## Benutzen

`index.html` herunterladen und im Browser öffnen — das ist die komplette Anwendung
(React 19 + gesamter App-Code in einer einzigen Datei gebündelt). Alternativ direkt
über GitHub Pages unter der Repository-URL.

Diagramme werden automatisch im Browser gesichert (IndexedDB) und lassen sich als
JSON, SVG, PNG, BPMN-2.0-XML, draw.io-XML oder PDF (über den Druckdialog) ausgeben.

## Entwickeln

Der Quellcode liegt unter `bpmn-editor-source/` (Vite, React 19, TypeScript, Zustand).

```bash
cd bpmn-editor-source
npm install
npm run dev     # Dev-Server auf http://localhost:5173
npm run verify  # Lint + Build + Export-Prüfung aller Shape-Typen
npm run ship    # verify + das ausgelieferte index.html aktualisieren
```

`index.html` im Wurzelverzeichnis ist das **gebaute Artefakt** und wird nie von Hand
bearbeitet.

## Dokumentation

| Datei | Inhalt |
|---|---|
| `CLAUDE.md` | Architektur, Entwurfsentscheidungen, Stolperfallen — der beste Einstieg |
| `Lastenheft-Zeichenwerkzeuge.md` | Anforderungen an Zeichenfläche und Werkzeuge (Z-01 … Z-19) |
| `Befundbericht-App-Analyse.md` | Ergebnis der systematischen Fehlersuche (F-01 … F-11) |
