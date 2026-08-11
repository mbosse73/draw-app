/**
 * Kopiert das Build-Ergebnis `dist/index.html` über das ausgelieferte
 * Artefakt `../index.html` und bestätigt die Gleichheit per Prüfsumme.
 *
 * Warum ein Skript und kein `cp`: Der Kopierschritt wurde regelmäßig
 * vergessen - dann ist die App gebaut, aber ausgeliefert wird weiter der
 * alte Stand, und zwar ohne jede Fehlermeldung. Als npm-Skript hängt er
 * fest an `npm run ship` und läuft plattformunabhängig (der Rechner des
 * Maintainers ist Windows, die Web-Sitzungen laufen unter Linux).
 *
 * Aufruf:  npm run artefakt      (nur kopieren)
 *          npm run ship          (bauen + prüfen + kopieren)
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const QUELLE = path.join(ROOT, "dist", "index.html");
const ZIEL = path.resolve(ROOT, "..", "index.html");

if (!fs.existsSync(QUELLE)) {
  console.error(`Kein Build gefunden: ${QUELLE}\nBitte zuerst "npm run build" ausführen.`);
  process.exit(2);
}

const md5 = (datei) => crypto.createHash("md5").update(fs.readFileSync(datei)).digest("hex");
const vorher = fs.existsSync(ZIEL) ? md5(ZIEL) : null;

fs.copyFileSync(QUELLE, ZIEL);

const nachher = md5(ZIEL);
if (nachher !== md5(QUELLE)) {
  console.error("Kopie stimmt nicht mit dem Build überein - Abbruch.");
  process.exit(1);
}

const groesse = (fs.statSync(ZIEL).size / 1024).toFixed(0);
console.log(
  vorher === nachher
    ? `index.html war bereits aktuell (${groesse} kB, md5 ${nachher.slice(0, 8)}).`
    : `index.html aktualisiert (${groesse} kB, md5 ${nachher.slice(0, 8)}).`
);
