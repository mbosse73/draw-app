#!/usr/bin/env node
/**
 * SessionStart-Hook: bringt eine frische Sitzung ohne Zutun in einen
 * arbeitsfähigen Zustand.
 *
 * Warum nötig: Ein frischer Clone enthält weder `node_modules` noch `dist/`.
 * Ohne diesen Hook beginnt jede Sitzung damit, das erst zu bemerken, und
 * verbrennt Kontext mit `npm install`-Fehlersuche. Der Hook erledigt genau
 * drei Dinge und meldet den Rest als Kurzlage:
 *
 *   1. `npm install` in `bpmn-editor-source/`, falls `node_modules` fehlt
 *   2. Chromium für `npm run check:export` auffindbar machen
 *      (CHECK_EXPORT_CHROMIUM in die Sitzungs-Umgebung schreiben)
 *   3. einmal bauen, falls `dist/` fehlt - `check:export` prüft das
 *      Build-Ergebnis und wäre sonst beim ersten Aufruf nicht lauffähig
 *   4. Kurzlage ausgeben: Branch, Sauberkeit, ob Artefakt und Build
 *      synchron sind
 *
 * Punkt 1 und 3 zahlen sich doppelt aus: Der Containerzustand wird nach dem
 * Hook zwischengespeichert, `node_modules` und `dist/` sind in Folgesitzungen
 * also schon da.
 *
 * Bewusst als .mjs statt .sh: läuft unter Linux (Web-Sitzung) genauso wie
 * unter Windows/PowerShell auf dem Rechner des Maintainers - Node ist in
 * diesem Projekt ohnehin Voraussetzung.
 *
 * Bewusst synchron (kein `{"async": true}`): der Hook ist im Normalfall in
 * unter einer Sekunde durch, weil `npm install` nur beim allerersten Start
 * eines Containers wirklich läuft. Ein asynchroner Lauf würde dafür die
 * Wettlaufsituation eröffnen, dass die erste Sitzungsaktion schon baut,
 * während die Abhängigkeiten noch installiert werden.
 */
import { execFileSync, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const wurzel = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const quelle = path.join(wurzel, "bpmn-editor-source");
const meldungen = [];

function md5(datei) {
  try {
    return crypto.createHash("md5").update(fs.readFileSync(datei)).digest("hex");
  } catch {
    return null;
  }
}

// 1. Abhängigkeiten
if (!fs.existsSync(path.join(quelle, "node_modules"))) {
  meldungen.push("npm install läuft (node_modules fehlte)…");
  try {
    execFileSync("npm", ["install", "--no-audit", "--no-fund"], { cwd: quelle, stdio: "pipe" });
    meldungen.push("npm install fertig.");
  } catch (e) {
    meldungen.push(`npm install FEHLGESCHLAGEN: ${String(e.stderr ?? e.message).slice(0, 400)}`);
  }
} else {
  meldungen.push("node_modules vorhanden.");
}

// 2. Chromium für check:export
if (!process.env.CHECK_EXPORT_CHROMIUM && process.env.CLAUDE_ENV_FILE) {
  const basis = process.env.PLAYWRIGHT_BROWSERS_PATH;
  const kandidaten = [];
  if (basis && fs.existsSync(basis)) {
    for (const eintrag of fs.readdirSync(basis)) {
      if (!eintrag.startsWith("chromium")) continue;
      kandidaten.push(
        path.join(basis, eintrag),
        path.join(basis, eintrag, "chrome-linux", "chrome"),
        path.join(basis, eintrag, "chrome-linux", "headless_shell")
      );
    }
  }
  const treffer = kandidaten.find((p) => {
    try {
      return fs.statSync(p).isFile();
    } catch {
      return false;
    }
  });
  if (treffer) {
    fs.appendFileSync(process.env.CLAUDE_ENV_FILE, `export CHECK_EXPORT_CHROMIUM="${treffer}"\n`);
    meldungen.push("CHECK_EXPORT_CHROMIUM gesetzt - `npm run check:export` ist lauffähig.");
  }
}

// 3. Erstbau, falls noch keiner vorliegt (ein frischer Clone hat kein dist/)
if (fs.existsSync(path.join(quelle, "node_modules")) && !fs.existsSync(path.join(quelle, "dist", "index.html"))) {
  try {
    execFileSync("npm", ["run", "build"], { cwd: quelle, stdio: "pipe" });
    meldungen.push("Erstbau erledigt (dist/ fehlte).");
  } catch (e) {
    meldungen.push(`npm run build FEHLGESCHLAGEN: ${String(e.stderr ?? e.message).slice(0, 400)}`);
  }
}

// 4. Kurzlage
try {
  const branch = execSync("git rev-parse --abbrev-ref HEAD", { cwd: wurzel }).toString().trim();
  const schmutzig = execSync("git status --porcelain", { cwd: wurzel }).toString().trim();
  meldungen.push(`Branch ${branch}, Arbeitsverzeichnis ${schmutzig ? "GEÄNDERT" : "sauber"}.`);
} catch {
  /* kein Git-Kontext - unkritisch */
}

const artefakt = md5(path.join(wurzel, "index.html"));
const build = md5(path.join(quelle, "dist", "index.html"));
if (!build) meldungen.push("Kein dist/index.html - vor `npm run check:export` erst `npm run build`.");
else if (artefakt !== build) meldungen.push("ACHTUNG: index.html (Wurzel) weicht von dist/index.html ab - `npm run ship` gleicht ab.");

console.log(meldungen.join(" "));
