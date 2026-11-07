/* ============================================================================
   GRAND ROULETTE — DOM: dealer panel, history board, seats, chip tray and
   buttons, table pointer handling, help and splash, keyboard.
   ========================================================================== */
(function (root) {
  'use strict';
  const RL = root.RL, C = RL.CONFIG;
  const $ = id => document.getElementById(id);
  const fmt = n => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const A = () => RL.audio;

  function UI(game, renderer) {
    this.game = game; this.renderer = renderer;
    this.el = { canvas: $('game'), tokens: $('tokens'), stats: $('stats'), status: $('status'), timer: $('timer'), seats: $('seats'), balance: $('balance'), betTotal: $('bet-total'), chips: Array.from(document.querySelectorAll('#tray .chip')),
      undo: $('btn-undo'), clear: $('btn-clear'), rebet: $('btn-rebet'), dbl: $('btn-double'), spin: $('btn-spin'), help: $('btn-help'), sound: $('btn-sound'), vol: $('vol'), message: $('message'),
      helpBox: $('help'), helpClose: $('help-close'), helpBody: $('help-body'), splash: $('splash'), splashText: $('splash-text') };
    this.splashVisible = true; this.ready = false; this.helpOpen = false; this.lastTokens = '';
    this.bind();
  }
  const P = UI.prototype;
  P.bind = function () {
    const g = this.game, e = this.el, R = this.renderer;
    const press = (el, fn) => el.addEventListener('click', ev => { ev.preventDefault(); A().init(); fn(); });
    e.chips.forEach(ch => press(ch, () => { g.chip = parseInt(ch.dataset.v, 10); A().chipStack(); this.refreshChips(); }));
    press(e.undo, () => g.undo()); press(e.clear, () => g.clear()); press(e.rebet, () => g.rebet()); press(e.dbl, () => g.doubleBets());
    press(e.spin, () => g.requestSpin());
    press(e.help, () => { A().tick(); this.toggleHelp(); }); press(e.helpClose, () => { A().tick(); this.toggleHelp(false); });
    press(e.sound, () => { const m = A().toggleMute(); this.updateSound(); if (!m) A().tick(); });
    e.vol.addEventListener('input', () => { A().init(); A().setVolume(parseFloat(e.vol.value)); if (A().muted) { A().setMuted(false); this.updateSound(); } });
    e.splash.addEventListener('pointerdown', () => { if (this.ready) this.start(); });
    e.canvas.addEventListener('pointermove', ev => { const p = R.toScene(ev.offsetX, ev.offsetY); R.hover = g.state === 'betting' ? RL.table.hitTest(p.x, p.y) : null; e.canvas.style.cursor = R.hover ? 'pointer' : 'default'; });
    e.canvas.addEventListener('pointerleave', () => { R.hover = null; });
    e.canvas.addEventListener('click', ev => { if (this.splashVisible) return; A().init(); const p = R.toScene(ev.offsetX, ev.offsetY); const spot = RL.table.hitTest(p.x, p.y); if (spot) g.placeBet('you', spot.id, g.chip, false); });
    e.canvas.addEventListener('contextmenu', ev => { ev.preventDefault(); if (this.splashVisible) return; const p = R.toScene(ev.offsetX, ev.offsetY); const spot = RL.table.hitTest(p.x, p.y); if (spot) this.removeFromSpot(spot.id); });
    root.addEventListener('keydown', ev => {
      if (ev.repeat) return;
      if (ev.code === 'Space' || ev.code === 'Enter') { ev.preventDefault(); A().init(); if (this.splashVisible) { if (this.ready) this.start(); } else if (this.helpOpen) this.toggleHelp(false); else g.requestSpin(); return; }
      if (this.splashVisible) return; A().init();
      switch (ev.code) {
        case 'Digit1': case 'Digit2': case 'Digit3': case 'Digit4': case 'Digit5': g.chip = C.chips[parseInt(ev.code.slice(5), 10) - 1].value; A().chipStack(); this.refreshChips(); break;
        case 'KeyU': g.undo(); break; case 'KeyC': g.clear(); break; case 'KeyR': g.rebet(); break; case 'KeyD': g.doubleBets(); break;
        case 'KeyH': this.toggleHelp(); break; case 'KeyM': A().toggleMute(); this.updateSound(); break; case 'Escape': this.toggleHelp(false); break;
        default: break;
      }
    });
    e.vol.value = A().volume; this.updateSound(); this.refreshChips();
  };
  P.removeFromSpot = function (spotId) { const g = this.game; if (g.state !== 'betting') return; for (let i = g.bets.length - 1; i >= 0; i--) if (g.bets[i].playerId === 'you' && g.bets[i].spotId === spotId) { const b = g.bets.splice(i, 1)[0]; g.players.byId.you.balance += b.amount; g.stats.wagered -= b.amount; A().chipStack(); return; } };
  P.start = function () { A().init(); this.splashVisible = false; this.el.splash.classList.add('hidden'); this.game.begin(); };
  P.assetsLoaded = function () { this.ready = true; this.el.splashText.textContent = 'TAKE A SEAT'; this.el.splash.classList.add('ready'); };
  P.refreshChips = function () { this.el.chips.forEach(ch => ch.classList.toggle('sel', parseInt(ch.dataset.v, 10) === this.game.chip)); };
  function set(el, text) { if (el && el._t !== text) { el._t = text; el.textContent = text; } }
  P.refresh = function () {
    const g = this.game, e = this.el, you = g.players.byId.you;
    set(e.balance, fmt(you.shown)); set(e.betTotal, fmt(g.humanTotal()));
    set(e.message, g.message);
    document.getElementById('stage').classList.toggle('zoomed', this.renderer.cam.zoom > 1.12);
    const betting = g.state === 'betting';
    e.spin.disabled = !betting; e.undo.disabled = !betting; e.clear.disabled = !betting; e.rebet.disabled = !betting; e.dbl.disabled = !betting;
    e.spin.classList.toggle('pulse', betting && g.bets.length > 0);
    const left = g.secondsLeft(); e.timer.style.width = betting ? (100 * left / g.timing.bettingMax).toFixed(1) + '%' : '0%';
    set(e.status, betting ? 'BETTING OPEN  ·  ' + Math.ceil(left) + 's' : g.state === 'closing' ? 'NO MORE BETS' : g.state === 'spinning' ? 'BALL IN PLAY' : g.state === 'result' ? 'RESULT' : g.state === 'payout' ? 'PAYING WINNERS' : '');
    /* history board */
    const key = g.history.join(',');
    if (key !== this.lastTokens) {
      this.lastTokens = key;
      e.tokens.innerHTML = g.history.map((n, i) => '<span class="tok ' + RL.colorOf(n) + (i === 0 ? ' new' : '') + '">' + n + '</span>').join('') || '<span class="empty">No spins yet</span>';
      const h = g.history, cnt = c => h.filter(n => RL.colorOf(n) === c).length, odd = h.filter(n => n > 0 && n % 2 === 1).length, even = h.filter(n => n > 0 && n % 2 === 0).length;
      const freq = {}; h.forEach(n => { freq[n] = (freq[n] || 0) + 1; }); const hot = Object.keys(freq).sort((a, b) => freq[b] - freq[a]).slice(0, 3).map(n => n + '×' + freq[n]).join('  ');
      e.stats.innerHTML = h.length ? '<b>RED</b> ' + cnt('red') + ' <b>BLACK</b> ' + cnt('black') + ' <b>ZERO</b> ' + cnt('green') + ' &nbsp; <b>ODD</b> ' + odd + ' <b>EVEN</b> ' + even + ' &nbsp; <b>HOT</b> ' + hot : '';
    }
    /* seats */
    g.players.list.forEach((p, i) => {
      const card = e.seats.children[i]; if (!card) return;
      set(card.querySelector('.bal'), fmt(p.shown));
      const w = g.roundWins[p.id]; set(card.querySelector('.last'), g.state === 'payout' ? (w ? '+' + fmt(w) : '—') : (p.id === 'you' ? '' : g.bets.filter(b => b.playerId === p.id).length ? 'betting' : ''));
      card.classList.toggle('won', g.state === 'payout' && !!w);
    });
  };
  P.updateSound = function () { this.el.sound.textContent = A().muted ? '🔇' : '🔊'; this.el.sound.classList.toggle('muted', A().muted); };
  P.toggleHelp = function (force) { const open = force == null ? !this.helpOpen : force; this.helpOpen = open; this.el.helpBox.classList.toggle('hidden', !open); };
  P.buildSeats = function () {
    this.el.seats.innerHTML = this.game.players.list.map(p => '<div class="seat" style="--c:' + p.color + '"><div class="dot"></div><div class="name">' + p.name + (p.human ? ' <small>(you)</small>' : '') + '</div><div class="bal">' + fmt(p.balance) + '</div><div class="last"></div></div>').join('');
  };
  P.buildHelp = function () {
    const rows = [['Straight up (one number)', '35 to 1'], ['Split (two numbers)', '17 to 1'], ['Street (three in a column) / Trio', '11 to 1'], ['Corner (four) / First four', '8 to 1'], ['Six line', '5 to 1'], ['Column / Dozen', '2 to 1'], ['Red, Black, Odd, Even, 1–18, 19–36', '1 to 1']];
    this.el.helpBody.innerHTML = '<table class="pays">' + rows.map(r => '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td></tr>').join('') + '</table>' +
      '<ul class="rules">' + C.rules.map(r => '<li>' + r + '</li>').join('') + '</ul>' +
      '<p class="hint">Pick a chip, click the layout to bet (lines and corners snap to the nearest spot), right-click a spot to take your chip back. SPACE closes bets and spins. U undo · C clear · R rebet · D double · 1–5 chips · H help · M mute.</p>';
  };
  RL.UI = UI;
})(window);
