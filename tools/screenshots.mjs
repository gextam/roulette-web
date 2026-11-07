#!/usr/bin/env node
/* ============================================================================
   tools/screenshots.mjs — headless smoke test + documentation screenshots.
   Chrome/Edge over the DevTools protocol, no dependencies (Node 22+). Serves
   the project, loads the table muted, drives a full round deterministically
   (RL.step / RL.DEBUG_NUMBER), asserts the maths and writes docs/screenshots.

   usage: node tools/screenshots.mjs [--chrome=<path>] [--width=1600] [--height=900]
   ========================================================================== */
import { spawn, execSync } from 'node:child_process';
import { createServer } from 'node:http';
import { promises as fs, existsSync, createReadStream, statSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'docs', 'screenshots');
const args = Object.fromEntries(process.argv.slice(2).map(a => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const W = parseInt(args.width || '1600', 10), H = parseInt(args.height || '900', 10), QUALITY = 86;
const wait = ms => new Promise(r => setTimeout(r, ms));
function which(cmd) { try { execSync((process.platform === 'win32' ? 'where ' : 'which ') + cmd, { stdio: 'ignore' }); return true; } catch { return false; } }
function findChrome() {
  if (args.chrome) return args.chrome;
  const env = process.env, pf = env.PROGRAMFILES || 'C:\\Program Files', pf86 = env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)';
  const c = process.platform === 'win32' ? [path.join(pf, 'Google', 'Chrome', 'Application', 'chrome.exe'), path.join(pf86, 'Google', 'Chrome', 'Application', 'chrome.exe'), path.join(env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'), path.join(pf86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'), path.join(pf, 'Microsoft', 'Edge', 'Application', 'msedge.exe')]
    : process.platform === 'darwin' ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'] : ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge'];
  for (const x of c) if (x.includes(path.sep) ? existsSync(x) : which(x)) return x;
  throw new Error('No Chrome/Edge found. Pass --chrome=<path>');
}
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.json': 'application/json', '.svg': 'image/svg+xml' };
function serve(root) {
  return new Promise(resolve => {
    const srv = createServer((req, res) => {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
      const file = path.normalize(path.join(root, p));
      if (!file.startsWith(root) || !existsSync(file) || statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      createReadStream(file).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}
class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); this.listeners = []; ws.addEventListener('message', ev => { const msg = JSON.parse(ev.data); if (msg.id && this.pending.has(msg.id)) { const { resolve, reject } = this.pending.get(msg.id); this.pending.delete(msg.id); msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result); } else if (msg.method) this.listeners.forEach(l => l(msg)); }); }
  send(method, params = {}) { const id = ++this.id; this.ws.send(JSON.stringify({ id, method, params })); return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject })); }
  on(fn) { this.listeners.push(fn); }
  once(method, timeout = 15000) { return new Promise(resolve => { const timer = setTimeout(() => { this.listeners = this.listeners.filter(x => x !== l); resolve(null); }, timeout); const l = msg => { if (msg.method === method) { clearTimeout(timer); this.listeners = this.listeners.filter(x => x !== l); resolve(msg.params); } }; this.listeners.push(l); }); }
  async eval(expression) { const r = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error('page error: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text)); return r.result.value; }
}
const wsOpen = url => new Promise((resolve, reject) => { const ws = new WebSocket(url); ws.addEventListener('open', () => resolve(ws)); ws.addEventListener('error', () => reject(new Error('websocket error'))); });
async function fetchJson(url, tries = 60) { for (let i = 0; i < tries; i++) { try { const r = await fetch(url); if (r.ok) return await r.json(); } catch { /* retry */ } await wait(250); } throw new Error('browser did not answer at ' + url); }

const SCENES = [
  { name: 'splash', run: 'true', check: null },
  { name: 'table', run: `RL.ui.start(); RL.step(0.3); const g = RL.game; const red = RL.table.spots.find(s => s.type === 'red').id;
      g.chip = 25; g.placeBet('you', 'straight:17', 25); g.placeBet('you', 'split:16-17', 25); g.placeBet('you', 'corner:16-17-19-20', 25); g.placeBet('you', red, 25); RL.step(9.5);
      JSON.stringify({ state: g.state, bets: g.bets.length, mine: g.humanBets().length, balance: g.players.byId.you.balance })`,
    check: r => r.state === 'betting' && r.mine === 4 && r.bets > 4 && r.balance === 900 },
  { name: 'spin', run: `RL.DEBUG_NUMBER = 17; RL.game.requestSpin(); RL.step(1.6); RL.step(1.5); JSON.stringify({ state: RL.game.state, ball: RL.game.wheel.ball.state })`, check: r => r.state === 'spinning' && r.ball === 'track' },
  { name: 'drop', run: `RL.step(4.9); JSON.stringify({ state: RL.game.state, ball: RL.game.wheel.ball.state, zoom: RL.renderer.cam.zoom })`, check: r => r.state === 'spinning' && (r.ball === 'drop' || r.ball === 'hop') },
  { name: 'result', run: `let n = 0; while (RL.game.state === 'spinning' && n++ < 200) RL.step(0.1); RL.step(1.0); const w = RL.game.wheel; JSON.stringify({ state: RL.game.state, number: RL.game.lastNumber, pocket: w.pocketAt(w.ball.phi), target: RL.pocketIndex(17), history: RL.game.history })`,
    check: r => r.state === 'result' && r.number === 17 && r.pocket === r.target && r.history[0] === 17 },
  { name: 'payout', run: `RL.step(2.0); JSON.stringify({ state: RL.game.state, balance: RL.game.players.byId.you.balance, wins: RL.game.roundWins })`, check: r => r.state === 'payout' && r.balance === 2475 },
  { name: 'next', run: `RL.step(7); JSON.stringify({ state: RL.game.state, round: RL.game.round })`, check: r => r.state === 'betting' && r.round === 2 },
  { name: 'help', run: `RL.ui.toggleHelp(true); 'ok'`, check: null },
  /* dealer video: wait for the speech segments to be detected, then speak a lip-synced line */
  { name: 'dealer', run: `RL.ui.toggleHelp(false); new Promise(resolve => { const t0 = Date.now(); const t = setInterval(() => { const n = Object.keys(RL.dealer.segments).length; if (n >= 6 || Date.now() - t0 > 12000) { clearInterval(t); const d = RL.dealer; d.queue.length = 0; clearTimeout(d.guard); d.speaking = false; d.current = null; RL.audio.muted = false; d.say('youwin', { priority: true }); setTimeout(() => { const cur = RL.dealer.current; resolve(JSON.stringify({ segments: Object.keys(RL.dealer.segments).length, videos: Object.keys(RL.dealer.videoReady).length, viaVideo: !!(cur && cur.seg), time: RL.dealer.el.video.currentTime })); RL.audio.muted = true; }, 1200); } }, 200); })`,
    check: r => r.videos >= 1 && r.segments >= 6 && r.viaVideo }
];

async function main() {
  const chrome = findChrome();
  await fs.mkdir(OUT, { recursive: true });
  const srv = await serve(ROOT);
  const url = `http://127.0.0.1:${srv.address().port}/index.html?mute=1`;
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'rl-shots-'));
  const debugPort = 9222 + Math.floor(Math.random() * 400);
  console.log('browser :', chrome); console.log('page    :', url);
  const proc = spawn(chrome, ['--headless=new', `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, `--window-size=${W},${H}`, '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', '--mute-audio', '--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling', 'about:blank'], { stdio: 'ignore' });
  let page = null; const errors = []; let failed = 0;
  try {
    await fetchJson(`http://127.0.0.1:${debugPort}/json/version`);
    const targets = await fetchJson(`http://127.0.0.1:${debugPort}/json/list`);
    page = new CDP(await wsOpen(targets.find(t => t.type === 'page').webSocketDebuggerUrl));
    page.on(msg => { if (msg.method === 'Runtime.exceptionThrown') errors.push('exception: ' + (msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text)); if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') errors.push('console: ' + msg.params.args.map(a => a.value || a.description).join(' ')); });
    await page.send('Page.enable'); await page.send('Runtime.enable');
    await page.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
    const loaded = page.once('Page.loadEventFired'); await page.send('Page.navigate', { url }); await loaded;
    const ready = await page.eval(`new Promise(r => { const t = setInterval(() => { if (window.RL && RL.ui && RL.ui.ready) { clearInterval(t); r(true); } }, 100); setTimeout(() => { clearInterval(t); r(false); }, 30000); })`);
    if (!ready) throw new Error('game did not finish loading');
    await wait(400);
    for (const scene of SCENES) {
      const out = await page.eval(scene.run);
      await page.eval('new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))');
      const { data } = await page.send('Page.captureScreenshot', { format: 'jpeg', quality: QUALITY });
      await fs.writeFile(path.join(OUT, scene.name + '.jpg'), Buffer.from(data, 'base64'));
      let ok = true, parsed = null;
      if (scene.check) { try { parsed = JSON.parse(out); ok = !!scene.check(parsed); } catch (e) { ok = false; } }
      if (!ok) failed++;
      console.log((scene.check ? (ok ? 'PASS ' : 'FAIL ') : '     ') + scene.name.padEnd(8) + ' ' + (typeof out === 'string' ? out : JSON.stringify(out)));
    }
    await fs.copyFile(path.join(OUT, 'table.jpg'), path.join(OUT, 'hero.jpg'));
  } finally {
    try { page && page.ws.close(); } catch { /* ignore */ }
    proc.kill(); srv.close(); await wait(300);
    await fs.rm(profile, { recursive: true, force: true }).catch(() => {});
  }
  if (errors.length) { console.log('\nPAGE ERRORS:'); errors.forEach(e => console.log(' -', e)); }
  if (failed || errors.length) { console.log('\n' + failed + ' check(s) failed, ' + errors.length + ' page error(s)'); process.exitCode = 2; } else console.log('\nall checks passed, no page errors');
}
main().catch(err => { console.error(err.message || err); process.exit(1); });
