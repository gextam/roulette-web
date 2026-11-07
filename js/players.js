/* ============================================================================
   GRAND ROULETTE — the other players at the table. Three regulars with
   different betting styles place chips during the betting window, keep
   balances, and re-buy when they run dry.
   ========================================================================== */
(function (root) {
  'use strict';
  const RL = root.RL, C = RL.CONFIG;
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];

  function Players() {
    this.list = C.players.map(p => Object.assign({ wonLast: 0, lastBets: [] }, p));
    this.byId = {}; this.list.forEach(p => { this.byId[p.id] = p; });
  }
  const P = Players.prototype;
  P.human = function () { return this.list[0]; };
  P.bots = function () { return this.list.slice(1); };

  /* plan the bets a bot will place this round: [{spotId, amount, at}] */
  P.plan = function (bot, round) {
    const spots = RL.table.spots, plan = [];
    const outside = spots.filter(s => !s.inside), straights = spots.filter(s => s.type === 'straight'), splits = spots.filter(s => s.type === 'split'), corners = spots.filter(s => s.type === 'corner'), cols = spots.filter(s => s.type === 'column' || s.type === 'dozen'), evens = spots.filter(s => ['red', 'black', 'odd', 'even', 'low', 'high'].includes(s.type));
    const budget = Math.max(0, bot.balance);
    const want = [];
    if (bot.style === 'outside') { want.push([pick(evens), pick([25, 50, 100, 200])]); if (Math.random() < 0.6) want.push([pick(cols), pick([25, 50, 100])]); if (Math.random() < 0.3) want.push([pick(evens), pick([25, 50])]); }
    else if (bot.style === 'inside') { const fav = bot.fav || (bot.fav = pick(straights)); want.push([fav, pick([5, 10, 25])]); const n = 1 + Math.floor(Math.random() * 3); for (let i = 0; i < n; i++) want.push([pick(Math.random() < 0.5 ? splits : straights), pick([5, 10, 25])]); if (Math.random() < 0.4) want.push([pick(corners), pick([10, 25])]); }
    else { want.push([pick(evens.concat(cols)), pick([50, 100])]); if (Math.random() < 0.7) want.push([pick(corners), pick([10, 25, 50])]); if (Math.random() < 0.5) want.push([pick(straights), pick([5, 10, 25])]); }
    let spent = 0;
    want.forEach(([spot, amt]) => { if (spent + amt <= budget) { spent += amt; plan.push({ spotId: spot.id, amount: amt, at: 1 + Math.random() * 7.5 }); } });
    if (round === 0) plan.forEach(p => { p.at += 2; });
    plan.sort((a, b) => a.at - b.at);
    return plan;
  };
  P.rebuyIfBroke = function (bot) { if (bot.balance < 25) { bot.balance += 1000; return true; } return false; };

  RL.Players = Players;
})(window);
