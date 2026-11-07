/* Verifies every bet spot on the layout returns 36/37 of the stake on average (house edge 2.70%). usage: node tools/edge-check.js */
'use strict';
const RL = require('../js/config.js'); require('../js/table.js');
const t = RL.table; const byType = {}; let bad = 0;
t.spots.forEach(s => {
  let ret = 0; for (let n = 0; n <= 36; n++) if (s.numbers.indexOf(n) >= 0) ret += s.payout + 1;
  const ev = ret / 37; byType[s.type] = ev;
  if (Math.abs(ev - 36 / 37) > 1e-9) { bad++; console.log('UNEXPECTED', s.id, ev); }
});
console.log('bet spots:', t.spots.length);
Object.keys(byType).forEach(k => console.log(k.padEnd(9), 'expected return', (byType[k] * 100).toFixed(2) + '%', ' house edge', ((1 - byType[k]) * 100).toFixed(2) + '%'));
/* Monte Carlo on a mixed strategy */
const picks = ['straight:17', 'split:16-17', 'corner:16-17-19-20', t.spots.find(s => s.type === 'red').id, t.spots.find(s => s.type === 'dozen').id, 'sixline:1-2-3-4-5-6'];
let wagered = 0, returned = 0; const N = 300000;
for (let i = 0; i < N; i++) { const n = Math.floor(Math.random() * 37); picks.forEach(id => { wagered += 10; returned += t.settle([{ spotId: id, playerId: 'x', amount: 10 }], n)[0].returned; }); }
console.log('Monte Carlo %d spins, mixed bets: return %s%%', N, (returned / wagered * 100).toFixed(2));
if (bad) process.exitCode = 1; else console.log('all spots pay 36/37 exactly');
