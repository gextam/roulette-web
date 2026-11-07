/* ============================================================================
   GRAND ROULETTE — scene renderer: salon backdrop, mahogany table with felt,
   the perspective wheel (bowl, track, deflectors, rotor, frets, numbers,
   turret, ball with blur and shadow), the printed layout with chips, the
   winning marker, payout animations and a camera that pushes in on the wheel.
   ========================================================================== */
(function (root) {
  'use strict';
  const RL = root.RL, ZEUS = root.ZEUS, C = RL.CONFIG, T = C.table, FX = ZEUS.fx;
  const W = 1920, H = 1080, TAU = Math.PI * 2;
  const WHEEL = { cx: 430, cy: 640, R: 300, sy: 0.6 };
  const FONT = '"Segoe UI", "Helvetica Neue", Arial, sans-serif';
  const SERIF = 'Georgia, "Times New Roman", serif';
  const fmt = n => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  RL.fmt = fmt; RL.LAYOUT = { W: W, H: H, WHEEL: WHEEL };

  function roundRect(ctx, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function shade(hex, k) { const n = parseInt(hex.slice(1), 16); const f = c => Math.max(0, Math.min(255, Math.round(k > 0 ? c + (255 - c) * k : c * (1 + k)))); return 'rgb(' + f(n >> 16) + ',' + f((n >> 8) & 255) + ',' + f(n & 255) + ')'; }
  function cover(ctx, img) { const r = Math.max(W / img.width, H / img.height), w = img.width * r, h = img.height * r; ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h); }

  /* the shared effects module expects a coin sprite provider */
  ZEUS.assets = ZEUS.assets || {};
  ZEUS.assets.coin = function () {
    if (ZEUS.assets._coin) return ZEUS.assets._coin;
    const s = 64, c = document.createElement('canvas'); c.width = c.height = s; const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(s * 0.38, s * 0.35, s * 0.05, s / 2, s / 2, s / 2);
    g.addColorStop(0, '#fff6c2'); g.addColorStop(0.35, '#f5d060'); g.addColorStop(0.8, '#b8860b'); g.addColorStop(1, '#6b4e07');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(s / 2, s / 2, s / 2 - 1, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(120,80,0,0.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(s / 2, s / 2, s / 2 - 6, 0, TAU); ctx.stroke();
    ZEUS.assets._coin = c; return c;
  };

  function Renderer(canvas, game) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d', { alpha: false }); this.game = game;
    this.scale = 1; this.dpr = 1; this.images = {}; this.hover = null;
    this.cam = { x: W / 2, y: H / 2, zoom: 1, tx: W / 2, ty: H / 2, tzoom: 1 };
    this.noise = null; this.flyers = []; this.labels = [];
    this.resize(); root.addEventListener('resize', () => this.resize());
  }
  const P = Renderer.prototype;
  P.resize = function () {
    const vw = root.innerWidth, vh = root.innerHeight, s = Math.min(vw / W, vh / H);
    this.scale = s; this.dpr = Math.min(2, root.devicePixelRatio || 1);
    const stage = document.getElementById('stage'); if (stage) stage.style.transform = 'translate(-50%,-50%) scale(' + s + ')';
    this.canvas.width = Math.round(W * s * this.dpr); this.canvas.height = Math.round(H * s * this.dpr);
    this.canvas.style.width = W + 'px'; this.canvas.style.height = H + 'px';
  };
  P.loadImages = function (files) {
    return Promise.all(Object.keys(files).map(k => new Promise(res => { const img = new Image(); img.onload = () => { this.images[k] = img; res(); }; img.onerror = () => res(); img.src = files[k]; })));
  };
  P.focusWheel = function (zoom) { this.cam.tx = WHEEL.cx + 40; this.cam.ty = WHEEL.cy - 40; this.cam.tzoom = zoom || 1.5; };
  P.focusTable = function () { this.cam.tx = W / 2; this.cam.ty = H / 2; this.cam.tzoom = 1; };
  /* screen (stage px) -> scene coords, through the camera */
  P.toScene = function (sx, sy) { const c = this.cam; return { x: (sx - W / 2) / c.zoom + c.x, y: (sy - H / 2) / c.zoom + c.y }; };
  P.update = function (dt) {
    const c = this.cam, k = Math.min(1, dt * 2.2);
    c.x += (c.tx - c.x) * k; c.y += (c.ty - c.y) * k; c.zoom += (c.tzoom - c.zoom) * k;
    this.flyers = this.flyers.filter(f => (f.t += dt) < f.dur);
    this.labels = this.labels.filter(l => (l.t += dt) < l.dur);
  };
  P.fly = function (from, to, color, dur, n) { for (let i = 0; i < (n || 1); i++) this.flyers.push({ x0: from.x + (Math.random() - 0.5) * 10, y0: from.y + (Math.random() - 0.5) * 10, x1: to.x + (Math.random() - 0.5) * 14, y1: to.y + (Math.random() - 0.5) * 8, color: color, t: -i * 0.04, dur: dur || 0.7 }); };
  P.label = function (x, y, text, color) { this.labels.push({ x: x, y: y, text: text, color: color || '#ffe9a8', t: 0, dur: 1.8 }); };

  P.draw = function (now) {
    const ctx = this.ctx, S = this.scale * this.dpr; this.now = now;
    ctx.setTransform(S, 0, 0, S, 0, 0);
    this.drawBackground(ctx);
    ctx.save();
    const c = this.cam; ctx.translate(W / 2, H / 2); ctx.scale(c.zoom, c.zoom); ctx.translate(-c.x, -c.y);
    this.drawTable(ctx);
    this.drawLayout(ctx);
    this.drawChips(ctx);
    this.drawMarker(ctx);
    this.drawWheel(ctx, now);
    this.drawFlyers(ctx);
    FX.drawBolts(ctx); FX.drawParticles(ctx);
    ctx.restore();
    this.drawLabels(ctx);
    FX.drawFlash(ctx, W, H);
  };

  P.drawBackground = function (ctx) {
    const img = this.images.bg;
    ctx.fillStyle = '#0b0a0c'; ctx.fillRect(0, 0, W, H);
    if (img) cover(ctx, img);
    const v = ctx.createRadialGradient(W * 0.5, H * 0.55, 200, W * 0.5, H * 0.55, 1300); v.addColorStop(0, 'rgba(0,0,0,0.05)'); v.addColorStop(1, 'rgba(0,0,0,0.75)'); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  };
  P.drawTable = function (ctx) {
    /* mahogany rail + felt */
    const x = 60, y = 190, w = W - 120, h = 760;
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 50; ctx.shadowOffsetY = 20; ctx.fillStyle = '#2a140a'; roundRect(ctx, x, y, w, h, 60); ctx.fill(); ctx.restore();
    let g = ctx.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, '#5a2b14'); g.addColorStop(0.3, '#3d1a0b'); g.addColorStop(0.6, '#6a3418'); g.addColorStop(1, '#2d1308');
    ctx.fillStyle = g; roundRect(ctx, x, y, w, h, 60); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,215,120,0.45)'; roundRect(ctx, x + 14, y + 14, w - 28, h - 28, 50); ctx.stroke();
    g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#1f6a40'); g.addColorStop(0.5, '#175633'); g.addColorStop(1, '#0f4027');
    ctx.fillStyle = g; roundRect(ctx, x + 34, y + 34, w - 68, h - 68, 36); ctx.fill();
    if (!this.noise) { const c = document.createElement('canvas'); c.width = c.height = 256; const cx = c.getContext('2d'), id = cx.createImageData(256, 256); for (let i = 0; i < id.data.length; i += 4) { const v = 128 + (Math.random() - 0.5) * 60; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; } cx.putImageData(id, 0, 0); this.noise = ctx.createPattern(c, 'repeat'); }
    ctx.save(); ctx.globalAlpha = 0.07; ctx.fillStyle = this.noise; roundRect(ctx, x + 34, y + 34, w - 68, h - 68, 36); ctx.fill(); ctx.restore();
    const sp = ctx.createRadialGradient(W * 0.55, y + 80, 50, W * 0.55, y + 80, 1100); sp.addColorStop(0, 'rgba(255,240,200,0.10)'); sp.addColorStop(1, 'rgba(0,0,0,0.18)'); ctx.fillStyle = sp; roundRect(ctx, x + 34, y + 34, w - 68, h - 68, 36); ctx.fill();
    /* wheel bowl recess */
    ctx.save(); ctx.translate(WHEEL.cx, WHEEL.cy); ctx.scale(1, WHEEL.sy);
    const rg = ctx.createRadialGradient(0, 0, WHEEL.R * 1.05, 0, 0, WHEEL.R * 1.3); rg.addColorStop(0, 'rgba(0,0,0,0.55)'); rg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(0, 0, WHEEL.R * 1.3, 0, TAU); ctx.fill(); ctx.restore();
  };

  /* ---------------------------------------------------------- layout */
  P.drawLayout = function (ctx) {
    const g = this.game, hover = this.hover, lit = new Set(hover ? hover.numbers : []);
    ctx.save(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(248,244,220,0.9)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const cell = (x, y, w, h, color, text, size, textColor) => {
      if (color) { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); }
      ctx.strokeRect(x, y, w, h);
      if (text) { ctx.fillStyle = textColor || '#f8f4dc'; ctx.font = '700 ' + (size || 30) + 'px ' + FONT; ctx.fillText(text, x + w / 2, y + h / 2 + 1); }
    };
    /* zero */
    cell(T.x, T.gridY, T.zeroW, T.gridH, lit.has(0) ? '#2fa05a' : '#1d7a40', '0', 34);
    for (let c = 0; c < 12; c++) for (let r = 0; r < 3; r++) {
      const n = RL.table.numAt(c, r), red = C.red.has(n), base = red ? '#b31f2a' : '#15151a';
      cell(T.gridX + c * T.cw, T.gridY + r * T.ch, T.cw, T.ch, lit.has(n) ? shade(base, 0.35) : base, String(n), 30);
    }
    RL.table.outsideRects.forEach(rc => {
      const s = rc.spot, on = hover && hover.id === s.id;
      let fill = on ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.12)';
      cell(rc.x, rc.y, rc.w, rc.h, fill, null);
      ctx.fillStyle = '#f8f4dc'; ctx.font = '700 ' + (s.type === 'column' ? 18 : 20) + 'px ' + FONT;
      if (s.type === 'red' || s.type === 'black') { ctx.fillStyle = s.type === 'red' ? '#c42a35' : '#121216'; ctx.beginPath(); const cx = rc.x + rc.w / 2, cy = rc.y + rc.h / 2; ctx.moveTo(cx, cy - 20); ctx.lineTo(cx + 26, cy); ctx.lineTo(cx, cy + 20); ctx.lineTo(cx - 26, cy); ctx.closePath(); ctx.fill(); ctx.strokeStyle = 'rgba(248,244,220,0.9)'; ctx.stroke(); }
      else ctx.fillText(s.label, rc.x + rc.w / 2, rc.y + rc.h / 2 + 1);
    });
    /* winning number glow */
    if (g.lastNumber != null && (g.state === 'result' || g.state === 'payout')) {
      const sp = RL.table.byId['straight:' + g.lastNumber]; ctx.save(); ctx.shadowColor = 'rgba(255,230,120,1)'; ctx.shadowBlur = 24 + 10 * Math.sin(this.now * 6); ctx.lineWidth = 4; ctx.strokeStyle = '#ffe17a';
      if (g.lastNumber === 0) ctx.strokeRect(T.x + 3, T.gridY + 3, T.zeroW - 6, T.gridH - 6); else ctx.strokeRect(sp.x - T.cw / 2 + 3, sp.y - T.ch / 2 + 3, T.cw - 6, T.ch - 6); ctx.restore();
    }
    /* table banner */
    ctx.font = '600 15px ' + SERIF; ctx.fillStyle = 'rgba(248,244,220,0.55)'; ctx.textAlign = 'left'; ctx.fillText('EUROPEAN ROULETTE  ·  SINGLE ZERO  ·  MINIMUM 1  ·  MAXIMUM 500 INSIDE  2,500 OUTSIDE', T.x, T.gridY - 16);
    ctx.restore();
  };
  P.drawChip = function (ctx, x, y, color, text, textColor, r) {
    r = r || 15;
    ctx.save(); ctx.translate(x, y); ctx.scale(1, 0.78);
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 3;
    ctx.fillStyle = shade(color, -0.35); ctx.beginPath(); ctx.arc(0, 4, r, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r); g.addColorStop(0, shade(color, 0.25)); g.addColorStop(1, shade(color, -0.1));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = r * 0.18; ctx.setLineDash([r * 0.5, r * 0.55]); ctx.beginPath(); ctx.arc(0, 0, r * 0.82, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = shade(color, 0.08); ctx.beginPath(); ctx.arc(0, 0, r * 0.6, 0, TAU); ctx.fill();
    if (text) { ctx.fillStyle = textColor || '#fff'; ctx.font = '900 ' + Math.round(r * (text.length > 2 ? 0.7 : 0.9)) + 'px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.scale(1, 1.28); ctx.fillText(text, 0, 1); }
    ctx.restore();
  };
  P.chipStyle = function (bet) {
    const pl = this.game.players.byId[bet.playerId];
    if (pl.human) { const ch = C.chips.slice().reverse().find(c => c.value <= bet.amount) || C.chips[0]; return { color: ch.color, text: String(bet.amount), textColor: ch.text }; }
    return { color: pl.color, text: String(bet.amount), textColor: pl.text };
  };
  P.drawChips = function (ctx) {
    const g = this.game, groups = {};
    g.bets.forEach(b => { (groups[b.spotId] = groups[b.spotId] || []).push(b); });
    Object.keys(groups).forEach(id => {
      const spot = RL.table.byId[id], list = groups[id], byPlayer = {};
      list.forEach(b => { (byPlayer[b.playerId] = byPlayer[b.playerId] || []).push(b); });
      const pids = Object.keys(byPlayer), k = pids.length;
      pids.forEach((pid, i) => {
        const ang = k === 1 ? 0 : (i / k) * TAU, off = k === 1 ? 0 : 11;
        const bx = spot.x + Math.cos(ang) * off, by = spot.y + Math.sin(ang) * off * 0.7;
        const stack = byPlayer[pid], total = stack.reduce((a, b) => a + b.amount, 0), nChips = Math.min(stack.length, 6);
        for (let j = 0; j < nChips; j++) { const st = this.chipStyle({ playerId: pid, amount: total }); this.drawChip(ctx, bx, by - j * 4, st.color, j === nChips - 1 ? st.text : null, st.textColor, 17); }
      });
    });
  };
  P.drawMarker = function (ctx) {
    const g = this.game; if (g.lastNumber == null || !(g.state === 'result' || g.state === 'payout')) return;
    const sp = RL.table.byId['straight:' + g.lastNumber]; const x = sp.x, y = sp.y - 6;
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 4;
    let gr = ctx.createLinearGradient(x - 10, 0, x + 10, 0); gr.addColorStop(0, '#d8c070'); gr.addColorStop(0.5, '#fff7d6'); gr.addColorStop(1, '#a88a3a');
    ctx.fillStyle = gr; ctx.fillRect(x - 9, y - 34, 18, 34);
    ctx.beginPath(); ctx.ellipse(x, y, 11, 6, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff7d6'; ctx.beginPath(); ctx.ellipse(x, y - 34, 9, 5, 0, 0, TAU); ctx.fill(); ctx.restore();
  };

  /* ----------------------------------------------------------- wheel */
  P.drawWheel = function (ctx, now) {
    const wh = this.game.wheel, R = WHEEL.R, cx = WHEEL.cx, cy = WHEEL.cy, SY = WHEEL.sy, order = C.wheelOrder, step = RL.WHEEL_STEP;
    ctx.save(); ctx.translate(cx, cy);
    /* drop shadow of the bowl */
    ctx.save(); ctx.scale(1, SY); const sh = ctx.createRadialGradient(0, 30, R, 0, 30, R * 1.25); sh.addColorStop(0, 'rgba(0,0,0,0.55)'); sh.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = sh; ctx.beginPath(); ctx.arc(0, 30, R * 1.25, 0, TAU); ctx.fill(); ctx.restore();
    ctx.scale(1, SY);
    /* bowl rim (mahogany) */
    let g = ctx.createRadialGradient(-R * 0.3, -R * 0.4, R * 0.2, 0, 0, R * 1.14); g.addColorStop(0, '#7a3b1c'); g.addColorStop(0.6, '#4a2210'); g.addColorStop(1, '#2a1208');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R * 1.14, 0, TAU); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,215,130,0.55)'; ctx.beginPath(); ctx.arc(0, 0, R * 1.11, 0, TAU); ctx.stroke();
    /* ball track */
    g = ctx.createRadialGradient(0, 0, R * 0.9, 0, 0, R * 1.02); g.addColorStop(0, '#6b3a1e'); g.addColorStop(0.5, '#c79a63'); g.addColorStop(1, '#5a2e14');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R * 1.02, 0, TAU); ctx.arc(0, 0, R * 0.9, 0, TAU, true); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(40,20,8,0.6)'; ctx.beginPath(); ctx.arc(0, 0, R * 0.96, 0, TAU); ctx.stroke();
    /* slope / cone */
    g = ctx.createRadialGradient(0, 0, R * 0.72, 0, 0, R * 0.9); g.addColorStop(0, '#3a1c0c'); g.addColorStop(1, '#5c2e14');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R * 0.9, 0, TAU); ctx.arc(0, 0, R * 0.72, 0, TAU, true); ctx.fill();
    for (let i = 0; i < 8; i++) { /* deflectors */
      const a = i * TAU / 8 + Math.PI / 8, dx = Math.cos(a) * R * 0.78, dy = Math.sin(a) * R * 0.78;
      ctx.save(); ctx.translate(dx, dy); ctx.rotate(a + (i % 2 ? Math.PI / 2 : 0));
      const dg = ctx.createLinearGradient(-8, -8, 8, 8); dg.addColorStop(0, '#fff6d6'); dg.addColorStop(0.5, '#b89a5a'); dg.addColorStop(1, '#5a4620');
      ctx.fillStyle = dg; ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(7, 0); ctx.lineTo(0, 14); ctx.lineTo(-7, 0); ctx.closePath(); ctx.fill(); ctx.restore();
    }
    /* rotor: number ring (outside) and pockets with frets (inside, where the ball rests) */
    ctx.save(); ctx.rotate(wh.theta);
    const blur = Math.abs(wh.omega) > 3;
    for (let i = 0; i < 37; i++) {
      const a0 = i * step - step / 2, a1 = a0 + step, n = order[i], col = n === 0 ? '#1f7a40' : C.red.has(n) ? '#b8232d' : '#17171c';
      const ng = ctx.createRadialGradient(0, 0, R * 0.6, 0, 0, R * 0.72); ng.addColorStop(0, shade(col, 0.1)); ng.addColorStop(1, shade(col, -0.15));
      ctx.fillStyle = ng; ctx.beginPath(); ctx.arc(0, 0, R * 0.72, a0, a1); ctx.arc(0, 0, R * 0.6, a1, a0, true); ctx.closePath(); ctx.fill();
      const pg = ctx.createRadialGradient(0, 0, R * 0.48, 0, 0, R * 0.6); pg.addColorStop(0, shade(col, -0.45)); pg.addColorStop(1, shade(col, -0.1));
      ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(0, 0, R * 0.6, a0, a1); ctx.arc(0, 0, R * 0.48, a1, a0, true); ctx.closePath(); ctx.fill();
      /* fret */
      ctx.strokeStyle = 'rgba(235,205,125,0.95)'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(Math.cos(a0) * R * 0.48, Math.sin(a0) * R * 0.48); ctx.lineTo(Math.cos(a0) * R * 0.72, Math.sin(a0) * R * 0.72); ctx.stroke();
      /* number on the outer ring */
      if (!blur || i % 2 === 0) {
        ctx.save(); ctx.rotate(a0 + step / 2); ctx.translate(R * 0.66, 0); ctx.rotate(Math.PI / 2);
        ctx.fillStyle = '#ffffff'; ctx.font = '700 ' + (n > 9 ? 19 : 21) + 'px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(n), 0, 0); ctx.restore();
      }
    }
    ctx.lineWidth = 3; ctx.strokeStyle = '#e6c878';
    [0.72, 0.6, 0.48].forEach(k => { ctx.beginPath(); ctx.arc(0, 0, R * k, 0, TAU); ctx.stroke(); });
    /* inner cone + turret */
    g = ctx.createRadialGradient(-R * 0.1, -R * 0.1, R * 0.05, 0, 0, R * 0.48); g.addColorStop(0, '#fff2c4'); g.addColorStop(0.35, '#d9b35b'); g.addColorStop(0.8, '#8a6420'); g.addColorStop(1, '#5a4014');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R * 0.48, 0, TAU); ctx.fill();
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; ctx.save(); ctx.rotate(a); const hg = ctx.createLinearGradient(0, -8, 0, 8); hg.addColorStop(0, '#fff6d6'); hg.addColorStop(1, '#8a6420'); ctx.fillStyle = hg; ctx.beginPath(); ctx.ellipse(R * 0.22, 0, R * 0.12, 7, 0, 0, TAU); ctx.fill(); ctx.restore(); }
    g = ctx.createRadialGradient(-R * 0.04, -R * 0.05, 2, 0, 0, R * 0.12); g.addColorStop(0, '#fffaf0'); g.addColorStop(0.5, '#e0bd63'); g.addColorStop(1, '#6a4a14'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R * 0.12, 0, TAU); ctx.fill();
    ctx.restore(); /* rotor rotation */
    /* highlights */
    g = ctx.createLinearGradient(-R, -R, R * 0.4, R * 0.5); g.addColorStop(0, 'rgba(255,255,255,0.22)'); g.addColorStop(0.5, 'rgba(255,255,255,0.0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R * 1.14, 0, TAU); ctx.fill();
    ctx.restore(); /* un-scale */
    /* ball */
    const b = wh.ball;
    if (b.state !== 'none') {
      const rr = R * (0.54 + (0.96 - 0.54) * Math.max(0, Math.min(1, (b.r - 0.62) / 0.38)));
      const px = Math.cos(b.phi) * rr, py = Math.sin(b.phi) * rr * SY, lift = b.h * 22;
      ctx.save(); ctx.translate(cx, cy);
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(px, py + 3, 9 + lift * 0.3, 4 + lift * 0.1, 0, 0, TAU); ctx.fill();
      if (b.state === 'track' && b.omega > 4) for (let k = 1; k <= 4; k++) { const a = b.phi - k * b.omega * 0.012; ctx.globalAlpha = 0.28 - k * 0.06; ctx.fillStyle = '#fff9ee'; ctx.beginPath(); ctx.arc(Math.cos(a) * rr, Math.sin(a) * rr * SY, 8.5, 0, TAU); ctx.fill(); }
      ctx.globalAlpha = 1;
      const bg = ctx.createRadialGradient(px - 3, py - lift - 3, 1, px, py - lift, 9); bg.addColorStop(0, '#ffffff'); bg.addColorStop(0.5, '#f3ead8'); bg.addColorStop(1, '#8e8470');
      ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(px, py - lift, 8.5 + lift * 0.05, 0, TAU); ctx.fill();
      ctx.restore();
    }
  };

  P.drawFlyers = function (ctx) {
    this.flyers.forEach(f => { if (f.t < 0) return; const u = f.t / f.dur, e = 1 - Math.pow(1 - u, 2); const x = f.x0 + (f.x1 - f.x0) * e, y = f.y0 + (f.y1 - f.y0) * e - Math.sin(u * Math.PI) * 60; ctx.save(); ctx.globalAlpha = 1 - Math.pow(u, 6); this.drawChip(ctx, x, y, f.color, null, null, 13); ctx.restore(); });
  };
  P.drawLabels = function (ctx) {
    this.labels.forEach(l => { const u = l.t / l.dur; ctx.save(); ctx.globalAlpha = 1 - u * u; ctx.font = '900 30px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 8; ctx.fillStyle = l.color; const p = this.toScreen(l.x, l.y - u * 50); ctx.fillText(l.text, p.x, p.y); ctx.restore(); });
  };
  P.toScreen = function (x, y) { const c = this.cam; return { x: (x - c.x) * c.zoom + W / 2, y: (y - c.y) * c.zoom + H / 2 }; };

  RL.Renderer = Renderer;
})(window);
