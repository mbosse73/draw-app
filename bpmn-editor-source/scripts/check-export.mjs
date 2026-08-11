/**
 * Vergleicht für JEDEN registrierten Shape-Typ die Bildschirmdarstellung mit
 * dem SVG-Export - pixelweise, im echten Browser.
 *
 * Hintergrund: `core/io/imageExport.ts` und `ui/Toolbox/ToolboxIcon.tsx` bauen
 * das Aussehen jedes Shapes unabhängig von den React-Komponenten nach. Läuft
 * eine der Kopien aus dem Takt, entsteht kein Fehler - es sieht nur still und
 * leise falsch aus. Genau so entstanden die 2026 gefundenen Export-Fehler
 * (fehlendes `fillStyle: "solid"`, zentrierte statt linksbündiger Labels,
 * ignoriertes Stil-Panel). Dieser Test hätte jeden davon sofort gemeldet.
 *
 * Aufruf:  npm run check:export   (oder `npm run verify` inkl. Build davor)
 * Voraussetzung: `npm run build` wurde ausgeführt (der Test prüft dist/index.html).
 * Chromium wird selbst gesucht (siehe findeChromium unten). Findet sich keines,
 * einmalig `npx playwright install chromium` - oder einen vorhandenen Browser
 * über CHECK_EXPORT_CHROMIUM=<pfad/zum/chrome> vorgeben.
 *
 * Exit-Code 1, sobald ein Typ mehr als TOLERANZ Prozent seiner "Tinte"
 * abweicht - damit taugt der Test auch als CI-Schritt.
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APP = process.env.CHECK_EXPORT_TARGET ?? path.join(ROOT, "dist", "index.html");
const TOLERANZ = Number(process.env.CHECK_EXPORT_TOLERANZ ?? 4); // Prozent der Tintenpixel
const DRAW = "rect,circle,ellipse,path,line,polygon,polyline,text,tspan,image";

if (!fs.existsSync(APP)) {
  console.error(`Artefakt nicht gefunden: ${APP}\nBitte zuerst "npm run build" ausführen.`);
  process.exit(2);
}

/** Chromium finden, ohne dass jede Umgebung erst `npx playwright install`
 *  braucht: ausdrücklich gesetzter Pfad > ein Browser unter
 *  PLAYWRIGHT_BROWSERS_PATH (so ist die Web-Sitzung vorkonfiguriert) >
 *  Playwrights eigene Suche. */
function findeChromium() {
  if (process.env.CHECK_EXPORT_CHROMIUM) return process.env.CHECK_EXPORT_CHROMIUM;
  const basis = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!basis || !fs.existsSync(basis)) return null;
  for (const eintrag of fs.readdirSync(basis).filter((e) => e.startsWith("chromium"))) {
    // Manche Umgebungen legen direkt eine ausführbare Datei (oder einen
    // Symlink darauf) ab, andere den entpackten Playwright-Ordner.
    for (const rel of [[], ["chrome-linux", "chrome"], ["chrome-linux", "headless_shell"], ["chrome-mac", "Chromium.app", "Contents", "MacOS", "Chromium"]]) {
      const p = path.join(basis, eintrag, ...rel);
      try {
        if (fs.statSync(p).isFile()) return p;
      } catch {
        /* Pfadvariante gibt es hier nicht */
      }
    }
  }
  return null;
}

const chromiumPfad = findeChromium();
const browser = await chromium.launch(chromiumPfad ? { executablePath: chromiumPfad } : {});
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
const konsole = [];
page.on("pageerror", (e) => konsole.push(String(e.message)));
page.on("console", (m) => m.type() === "error" && konsole.push(m.text()));
page.on("dialog", (d) => d.accept());
await page.goto("file://" + APP);
await page.waitForTimeout(900);

// Alle Toolbox-Kategorien aufklappen, damit jeder Typ greifbar ist
for (let i = 0; i < 4; i++) {
  const zu = page.locator('.toolbox-category-header[aria-expanded="false"]');
  const n = await zu.count();
  if (!n) break;
  for (let k = n - 1; k >= 0; k--) await zu.nth(k).click({ timeout: 2500 }).catch(() => {});
  await page.waitForTimeout(150);
}

const typen = await page.evaluate(() => {
  const out = [];
  for (const el of document.querySelectorAll(".toolbox-item")) {
    const dt = new DataTransfer();
    el.dispatchEvent(new DragEvent("dragstart", { bubbles: true, cancelable: true, dataTransfer: dt }));
    out.push({ titel: el.title, typ: dt.getData("application/shape-type") });
  }
  return out;
});

async function leeren() {
  await page.mouse.click(700, 520);
  await page.keyboard.press("Control+a");
  await page.keyboard.press("Delete");
  await page.waitForTimeout(90);
}

async function ablegen(titel) {
  await page.evaluate((t) => {
    const el = [...document.querySelectorAll(".toolbox-item")].find((e) => e.title === t);
    const svg = document.querySelector(".canvas-container svg");
    const dt = new DataTransfer();
    el.dispatchEvent(new DragEvent("dragstart", { bubbles: true, cancelable: true, dataTransfer: dt }));
    const r = svg.getBoundingClientRect();
    const pt = { clientX: r.left + 340, clientY: r.top + 260, bubbles: true, cancelable: true, dataTransfer: dt };
    svg.dispatchEvent(new DragEvent("dragover", pt));
    svg.dispatchEvent(new DragEvent("drop", pt));
  }, titel);
  await page.waitForTimeout(180);
}

async function svgExportieren() {
  for (let versuch = 0; versuch < 4; versuch++) {
    try {
      await page.keyboard.press("Escape");
      await page.waitForTimeout(110);
      await page.locator(".menubar-trigger", { hasText: "Datei" }).click();
      await page.waitForTimeout(170);
      await page.locator(".menubar-dropdown button", { hasText: "Export" }).click({ timeout: 4000 });
      await page.waitForTimeout(190);
      const [dl] = await Promise.all([
        page.waitForEvent("download", { timeout: 10000 }),
        page.locator(".menu-flyout button", { hasText: "Als SVG" }).click({ timeout: 4000 }),
      ]);
      return fs.readFileSync(await dl.path(), "utf8");
    } catch (e) {
      if (versuch === 3) throw e;
      await page.waitForTimeout(300);
    }
  }
}

const ergebnisse = [];
for (const { titel, typ } of typen) {
  // Boundary Events lassen sich nicht frei ablegen (sie brauchen einen Host)
  if (typ.includes("boundaryEvent")) continue;
  await leeren();
  await ablegen(titel);
  await page.mouse.click(1100, 780); // deselektieren
  await page.waitForTimeout(90);

  const live = await page.evaluate(() => {
    // Ueber die stabile Kennung statt ueber Position/Reihenfolge - letzteres
    // greift daneben, sobald eine weitere Ebene dazwischenkommt.
    const g = document.querySelector(".canvas-container svg g[data-shape-id]");
    const innen = g?.querySelector('g[transform^="translate"]');
    return innen ? innen.outerHTML : null;
  });
  if (!live) {
    ergebnisse.push({ typ, fehler: "kein Live-Element" });
    continue;
  }
  const exportSvg = await svgExportieren();

  const messung = await page.evaluate(
    async ({ live, exportSvg, DRAW }) => {
      const vb = exportSvg.match(/viewBox="([^"]+)"/)[1];
      const [vx, vy, w, h] = vb.split(/\s+/).map(Number);
      const S = 2;
      const huelle = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${w * S}" height="${h * S}" font-family="sans-serif"><rect x="${vx}" y="${vy}" width="${w}" height="${h}" fill="#ffffff"/>${live}</svg>`;
      const exportNorm = exportSvg
        .replace("<svg ", '<svg font-family="sans-serif" ')
        .replace(/width="[\d.]+"\s+height="[\d.]+"/, `width="${w * S}" height="${h * S}"`);

      const malen = (quelle) =>
        new Promise((res, rej) => {
          const img = new Image();
          img.onload = () => {
            const c = document.createElement("canvas");
            c.width = w * S;
            c.height = h * S;
            const ctx = c.getContext("2d");
            ctx.fillStyle = "#fff";
            ctx.fillRect(0, 0, c.width, c.height);
            ctx.drawImage(img, 0, 0, c.width, c.height);
            res(ctx.getImageData(0, 0, c.width, c.height).data);
          };
          img.onerror = rej;
          img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(quelle);
        });

      const [A, B] = [await malen(huelle), await malen(exportNorm)];
      let abweichend = 0;
      let tinte = 0;
      for (let i = 0; i < A.length; i += 4) {
        const d = Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]);
        if (d > 60) abweichend++;
        if (A[i] < 245 || A[i + 1] < 245 || A[i + 2] < 245) tinte++;
      }
      return { abweichend, tinte, prozent: tinte ? +((100 * abweichend) / tinte).toFixed(1) : 0 };
    },
    { live, exportSvg, DRAW }
  );
  ergebnisse.push({ typ, ...messung });
}
await browser.close();

const schlecht = ergebnisse.filter((r) => r.fehler || r.prozent > TOLERANZ);
const gut = ergebnisse.length - schlecht.length;

console.log(`\nBildschirm gegen SVG-Export, ${ergebnisse.length} Shape-Typen (Toleranz ${TOLERANZ}% der Tintenpixel)\n`);
if (schlecht.length) {
  console.log("Abweichungen:");
  for (const r of schlecht.sort((a, b) => (b.prozent ?? 0) - (a.prozent ?? 0))) {
    console.log(`  ${r.typ.padEnd(34)} ${r.fehler ?? r.prozent + "% der Tintenpixel abweichend"}`);
  }
  console.log("");
}
console.log(`${gut} von ${ergebnisse.length} Typen im Rahmen.`);
if (konsole.length) console.log(`\nBrowser-Meldungen:\n  ${konsole.slice(0, 5).join("\n  ")}`);

process.exit(schlecht.length ? 1 : 0);
