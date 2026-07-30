// Open index.html in a real browser, OVER HTTP, and hand back the page.
//
// ⚠⚠ THE `file://` TRAP, AND IT COSTS ~2 MINUTES OF STARING AT A HUNG SCRIPT EVERY TIME.
// `plan.mjs` and `probe.mjs` both used `page.goto('file://' + …)`. The page loads, the DOM script
// evaluates, every function is defined, `#btn-run` clicks — and NOTHING HAPPENS, with no page error
// and no console output. The optimizer runs in a Web Worker the app builds from an inline **Blob URL**
// (`runOptimize`), and Chromium refuses to instantiate a worker from a Blob on a `file://` origin
// because that origin is opaque. The failure is silent by construction: the worker never starts, so
// nothing ever rejects.
// ⇒ Serve the repo over http. `tests/page-equiv.mjs` already did this and said so in its header; that
// file is deleted with the sim, so the knowledge moves here — the one shared helper — rather than being
// re-derived a third time.
//
// ★ WHY THIS MATTERS MORE THAN IT USED TO. `tools/plan-sweep.mjs` runs the DOM-free engine, so it never
// touches `renderTimeline`/`scheduleRows`/`planText`. Opening the page is now the ONLY check on the
// render path, and on 2026-07-30 that path shipped a real defect — the plan printed FIRE times, so a
// press intent of 0:05 displayed as "0:06" and split a cluster the optimizer had deliberately
// co-pressed. No headless gate could have seen it.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
};

function resolveChromium() {
  if (process.env.CHROMIUM) return process.env.CHROMIUM;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!root) return undefined;
  try {
    for (const d of fs.readdirSync(root).filter(n => n.startsWith('chromium')).sort().reverse()) {
      const exe = path.join(root, d, 'chrome-linux', 'chrome');
      if (fs.existsSync(exe)) return exe;
    }
  } catch { /* fall through to playwright's own resolution */ }
  return undefined;
}

export async function openPage({ file = 'index.html' } = {}) {
  const server = http.createServer((req, res) => {
    const f = path.join(REPO, decodeURIComponent(req.url.split('?')[0]));
    if (!f.startsWith(REPO)) { res.statusCode = 403; return res.end(); }
    fs.readFile(f, (err, data) => {
      if (err) { res.statusCode = 404; return res.end(); }
      res.setHeader('Content-Type', MIME[path.extname(f)] || 'application/octet-stream');
      res.end(data);
    });
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;

  // ⚠ The old hardcoded '/opt/pw-browsers/chromium' is a DIRECTORY, not an executable, so it failed
  // with "executable doesn't exist" wherever the install is versioned. Resolve in three steps:
  //   1. $CHROMIUM if set — an explicit path always wins.
  //   2. a versioned chromium under $PLAYWRIGHT_BROWSERS_PATH — playwright-core's own auto-resolution
  //      only finds a build whose REVISION matches the installed playwright, which is a version pin
  //      this repo has no reason to care about for a dev scope.
  //   3. plain launch() and let playwright complain properly.
  const browser = await chromium.launch({ executablePath: resolveChromium() });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(`http://127.0.0.1:${port}/${file}`, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.__enginereadyprobe !== 'undefined' || typeof document.getElementById('btn-run') !== 'undefined');

  return {
    page, errors,
    async close() { await browser.close(); server.close(); },
  };
}

// Load a declared-test / boss preset by the text on its chip, then solve, then return the plan text.
// The chips live inside a <details>, so they are not "visible" to a normal click until it is open —
// hence the explicit open + in-page .click() rather than page.click().
export async function solvePreset(page, chipText, { timeout = 180000 } = {}) {
  await page.evaluate(() => document.querySelectorAll('details').forEach(d => { d.open = true; }));
  const found = await page.evaluate(t => {
    const n = [...document.querySelectorAll('.pchips .pchip')].find(x => x.textContent.includes(t));
    if (!n) return false;
    n.click();
    return true;
  }, chipText);
  if (!found) throw new Error(`no preset chip matching ${JSON.stringify(chipText)} — see GOLDEN_PRESETS / BOSS_PRESETS in index.html`);
  await page.evaluate(() => document.getElementById('btn-run').click());
  await page.waitForFunction(() => !!window.__run, null, { timeout });
  return page.evaluate(() => planText(window.__run));
}
