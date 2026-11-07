/* ============================================================================
   GRAND ROULETTE — round flow: betting window with the regulars placing
   chips, no more bets, the spin, the result call, the marker, sweeping
   losers, paying winners, the dealer's call-outs, the history board.
   ========================================================================== */
(function (root) {
  'use strict';
  const RL = root.RL, C = RL.CONFIG, FX = root.ZEUS.fx;
  const A = () => RL.audio;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function rngInt(n) { const c = root.crypto; if (c && c.getRandomValues) { const max = Math.floor(0x100000000 / n) * n, a = new Uint32Array(1); do { c.getRandomValues(a); } while (a[0] >= max); return a[0] % n; } return Math.floor(Math.random() * n); }
  const SEATS = { you: { x: 950, y: 690 }, sophia: { x: 1215, y: 690 }, marcus: { x: 1480, y: 690 }, elena: { x: 1745, y: 690 } };
  const DEALER_POS = { x: 300, y: 330 };

  function Game() {
    this.players = new RL.Players(); this.wheel = new RL.Wheel();
    this.wheel.onEvent = (name, data) => this.onWheelEvent(name, data);
    this.dealer = null; this.renderer = null;
    this.state = 'boot'; this.bets = []; this.lastHumanBets = []; this.history = []; this.round = 0; this.lastNumber = null;
    this.now = 0; this.betOpenAt = 0; this.closeAt = 0; this.spinAt = 0; this.payAt = 0; this.nextRoundAt = 0; this.camBackAt = 0;
    this.botPlan = []; this.lastBetsSaid = false; this.chip = 25; this.message = 'WELCOME'; this.timing = Object.assign({}, C.timing);
    this.stats = { rounds: 0, wagered: 0, won: 0 }; this.roundWins = {};
    this.players.list.forEach(p => { p.shown = p.balance; });
  }
  const P = Game.prototype;

  P.begin = function () { A().startAmbience(); this.dealer.say('greet'); this.beginBetting(true); };
  P.setMessage = function (m) { this.message = m; };
  P.humanBets = function () { return this.bets.filter(b => b.playerId === 'you'); };
  P.humanTotal = function () { return this.humanBets().reduce((a, b) => a + b.amount, 0); };

  P.beginBetting = function (first) {
    this.round++; this.state = 'betting'; this.betOpenAt = this.now; this.bets = []; this.lastBetsSaid = false;
    this.closeAt = this.now + this.timing.bettingMax; this.roundWins = {};
    if (this.renderer) this.renderer.focusTable();
    this.botPlan = this.players.bots().map(b => ({ bot: b, plan: this.players.plan(b, this.round - 1) }));
    if (!first) this.dealer.say('placebets', { dedupe: 8 });
    this.setMessage('PLACE YOUR BETS');
  };
  P.update = function (now, dt) {
    this.now = now;
    this.wheel.update(now, dt);
    this.players.list.forEach(p => { p.shown += (p.balance - p.shown) * Math.min(1, dt * 4); if (Math.abs(p.balance - p.shown) < 0.6) p.shown = p.balance; });
    if (this.state === 'betting') {
      this.botPlan.forEach(bp => { while (bp.plan.length && now - this.betOpenAt >= bp.plan[0].at) { const p = bp.plan.shift(); this.placeBet(bp.bot.id, p.spotId, p.amount, true); } });
      if (!this.lastBetsSaid && now - this.betOpenAt > this.timing.lastBetsAt && this.bets.length) { this.lastBetsSaid = true; this.dealer.say('lastbets', { dedupe: 20 }); }
      if (now >= this.closeAt) { if (this.bets.length) this.closeBets(); else this.closeAt = now + 10; }
    } else if (this.state === 'closing') { if (now >= this.spinAt) this.spin(); }
    else if (this.state === 'spinning') {
      const b = this.wheel.ball; A().ballRollSet(b.omega, b.r);
      if ((b.state === 'drop' || b.state === 'hop') && this.renderer) this.renderer.focusWheel(1.85);
    } else if (this.state === 'result') {
      if (this.camBackAt && now >= this.camBackAt && this.renderer) { this.renderer.focusTable(); this.camBackAt = 0; }
      if (now >= this.payAt) this.payout();
    } else if (this.state === 'payout') { if (now >= this.nextRoundAt) this.beginBetting(false); }
  };

  /* ------------------------------------------------------------- bets */
  P.placeBet = function (playerId, spotId, amount, isBot) {
    if (this.state !== 'betting') { if (!isBot) { A().deny(); this.setMessage('BETS ARE CLOSED'); } return false; }
    const pl = this.players.byId[playerId], spot = RL.table.byId[spotId]; if (!pl || !spot) return false;
    const existing = this.bets.filter(b => b.playerId === playerId && b.spotId === spotId).reduce((a, b) => a + b.amount, 0);
    const limit = spot.inside ? C.limits.inside : C.limits.outside;
    if (existing + amount > limit) { if (!isBot) { A().deny(); this.setMessage('TABLE LIMIT REACHED ON THAT BET'); } return false; }
    if (pl.balance < amount) { if (!isBot) { A().deny(); this.setMessage('INSUFFICIENT BALANCE'); } return false; }
    pl.balance -= amount;
    this.bets.push({ playerId: playerId, spotId: spotId, amount: amount, t: this.now });
    if (!isBot) { this.stats.wagered += amount; this.setMessage(spotLabel(spot) + '  ·  ' + amount); }
    A().chipPlace();
    if (this.renderer) { const from = SEATS[playerId] || SEATS.you; const color = pl.human ? (C.chips.slice().reverse().find(c => c.value <= amount) || C.chips[0]).color : pl.color; this.renderer.fly(from, spot, color, 0.45, 1); }
    return true;
  };
  function spotLabel(s) { if (s.type === 'straight') return 'STRAIGHT UP ' + s.numbers[0]; if (s.label) return s.label; return s.type.toUpperCase() + ' ' + s.numbers.join('-'); }
  P.undo = function () { if (this.state !== 'betting') { A().deny(); return; } for (let i = this.bets.length - 1; i >= 0; i--) if (this.bets[i].playerId === 'you') { const b = this.bets.splice(i, 1)[0]; this.players.byId.you.balance += b.amount; this.stats.wagered -= b.amount; A().chipStack(); return; } A().deny(); };
  P.clear = function () { if (this.state !== 'betting') { A().deny(); return; } let n = 0; this.bets = this.bets.filter(b => { if (b.playerId !== 'you') return true; this.players.byId.you.balance += b.amount; this.stats.wagered -= b.amount; n++; return false; }); if (n) A().chipSweep(); else A().deny(); };
  P.rebet = function () { if (this.state !== 'betting' || !this.lastHumanBets.length) { A().deny(); return; } this.lastHumanBets.forEach(b => this.placeBet('you', b.spotId, b.amount, false)); };
  P.doubleBets = function () { if (this.state !== 'betting') { A().deny(); return; } const mine = this.humanBets().slice(); if (!mine.length) { A().deny(); return; } mine.forEach(b => this.placeBet('you', b.spotId, b.amount, false)); };
  P.requestSpin = function () {
    if (this.state === 'betting') { if (!this.bets.length) { A().deny(); this.setMessage('PLACE A BET FIRST'); return; } this.closeBets(); }
  };
  P.closeBets = function () {
    if (this.state !== 'betting') return;
    this.state = 'closing'; this.lastHumanBets = this.humanBets().map(b => ({ spotId: b.spotId, amount: b.amount }));
    this.dealer.say('nomore', { priority: true }); A().noMoreBets(); this.spinAt = this.now + 1.5; this.setMessage('NO MORE BETS');
  };

  /* ------------------------------------------------------------- spin */
  P.spin = function () {
    this.state = 'spinning';
    const n = RL.DEBUG_NUMBER != null ? RL.DEBUG_NUMBER : rngInt(37);
    this.pending = n; this.wheel.spin(RL.pocketIndex(n), this.now);
    if (this.renderer) this.renderer.focusWheel(1.35);
    A().ballLaunch(); this.setMessage('THE BALL IS IN PLAY');
    if (this.round % 3 === 1) this.dealer.say(this.round % 2 ? 'inplay' : 'closed', { dedupe: 40 });
  };
  P.onWheelEvent = function (name, data) {
    if (name === 'deflector') A().deflector(data.speed);
    else if (name === 'hop') A().hop(data.n);
    else if (name === 'fret') A().fret();
    else if (name === 'seated') this.result(data.number);
  };
  P.result = function (n) {
    this.state = 'result'; this.lastNumber = n; A().ballRollStop(); A().seated();
    this.history.unshift(n); if (this.history.length > C.history) this.history.length = C.history;
    this.dealer.say('n' + n, { priority: true });
    this.setMessage(n + '  ' + RL.colorOf(n).toUpperCase());
    this.payAt = this.now + 2.4; this.camBackAt = this.now + 1.5; this.stats.rounds++;
    setTimeout(() => A().dolly(), 1300);
  };
  P.payout = function () {
    this.state = 'payout';
    const res = RL.table.settle(this.bets, this.lastNumber), R = this.renderer;
    const profit = {}; let anyWin = false, humanReturned = 0;
    res.forEach(r => {
      if (r.win) {
        anyWin = true; const pl = this.players.byId[r.bet.playerId]; pl.balance += r.returned; profit[pl.id] = (profit[pl.id] || 0) + r.payout;
        if (pl.human) humanReturned += r.returned;
        if (R) { R.fly(DEALER_POS, r.spot, pl.human ? '#e9c250' : pl.color, 0.8, Math.min(6, 1 + Math.floor(r.payout / 50))); R.label(r.spot.x, r.spot.y - 30, '+' + RL.fmt(r.payout), pl.human ? '#ffe9a8' : pl.color); }
      } else if (R) R.fly(r.spot, DEALER_POS, this.players.byId[r.bet.playerId].human ? '#e9c250' : this.players.byId[r.bet.playerId].color, 0.6, 1);
    });
    this.roundWins = profit; this.stats.won += humanReturned;
    A().chipSweep(); setTimeout(() => A().chipPay(Object.keys(profit).length * 4), 500);
    /* keep winning chips on the layout a moment, drop the losers now */
    this.bets = this.bets.filter(b => RL.table.byId[b.spotId].numbers.indexOf(this.lastNumber) >= 0);
    const winners = Object.keys(profit).sort((a, b) => profit[b] - profit[a]), top = winners[0];
    if (!anyWin) this.dealer.say('nowin', { dedupe: 30 });
    else {
      if (profit[top] >= 1000) { this.dealer.say('bigwin'); A().winChime(true); FX.coins(40, { x: 1350 }); }
      else A().winChime(profit.you > 0 && profit.you >= 200);
      if (profit.you) this.dealer.say('youwin', { dedupe: 25 });
      else if (RL.LINES[top]) this.dealer.say(top, { dedupe: 25 });
      if (winners.length >= 2 && !profit.you) this.dealer.say('winners', { dedupe: 40 });
    }
    this.players.bots().forEach(b => { if (this.players.rebuyIfBroke(b)) this.setMessage(b.name.toUpperCase() + ' BUYS IN FOR 1,000'); });
    if (profit.you) this.setMessage('YOU WIN ' + RL.fmt(profit.you));
    this.nextRoundAt = this.now + this.timing.resultHold;
  };
  P.secondsLeft = function () { return this.state === 'betting' ? Math.max(0, this.closeAt - this.now) : 0; };

  RL.Game = Game; RL.SEATS = SEATS;
})(window);
