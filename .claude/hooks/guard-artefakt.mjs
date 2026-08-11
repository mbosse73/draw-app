#!/usr/bin/env node
/**
 * PreToolUse-Hook: schützt das ausgelieferte Artefakt vor Handarbeit.
 *
 * `index.html` im Wurzelverzeichnis ist das minifizierte Build-Ergebnis. Es
 * von Hand zu editieren (oder zu versuchen, das Bundle zu patchen) erzeugt
 * einen Stand, den kein Build reproduzieren kann - der nächste
 * `npm run build` wirft die Änderung stillschweigend weg. Diese Regel steht
 * seit jeher in CLAUDE.md; hier wird sie zusätzlich technisch durchgesetzt,
 * damit sie auch dann greift, wenn die Anweisung im Kontext untergegangen
 * ist.
 *
 * Exit-Code 2 blockiert den Werkzeugaufruf; der Text auf stderr geht an
 * Claude zurück und nennt den richtigen Weg.
 */
import fs from "node:fs";
import path from "node:path";

let eingabe = "";
try {
  eingabe = fs.readFileSync(0, "utf8");
} catch {
  process.exit(0);
}

let daten;
try {
  daten = JSON.parse(eingabe);
} catch {
  process.exit(0);
}

const ziel = daten?.tool_input?.file_path;
if (!ziel) process.exit(0);

const wurzel = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const artefakt = path.resolve(wurzel, "index.html");

if (path.resolve(ziel) === artefakt) {
  process.stderr.write(
    "Blockiert: index.html im Wurzelverzeichnis ist das gebaute Artefakt und wird nie von Hand bearbeitet.\n" +
      "Richtiger Weg: Quelle unter bpmn-editor-source/src/ ändern, dann `npm run ship`\n" +
      "(baut, prüft den Export und kopiert dist/index.html über die Wurzeldatei).\n"
  );
  process.exit(2);
}

process.exit(0);
