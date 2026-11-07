/* ============================================================================
   GRAND ROULETTE — configuration: European single-zero wheel, bet types and
   payouts, table geometry, chips, players and timings.
   Shared by the browser (window.RL) and node tools (module.exports).
   ========================================================================== */
(function (root) {
  'use strict';
  const RL = root.RL || (root.RL = {});

  /* wheel pocket order, clockwise as seen from above */
  const WHEEL_ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
  const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
  const colorOf = n => (n === 0 ? 'green' : RED.has(n) ? 'red' : 'black');
  const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty', 'twenty-one', 'twenty-two', 'twenty-three', 'twenty-four', 'twenty-five', 'twenty-six', 'twenty-seven', 'twenty-eight', 'twenty-nine', 'thirty', 'thirty-one', 'thirty-two', 'thirty-three', 'thirty-four', 'thirty-five', 'thirty-six'];

  /* payout = profit per unit staked (stake is returned as well) */
  const PAYOUT = { straight: 35, split: 17, street: 11, trio: 11, corner: 8, first4: 8, sixline: 5, column: 2, dozen: 2, low: 1, high: 1, red: 1, black: 1, even: 1, odd: 1 };
  const LIMITS = { inside: 500, outside: 2500, min: 1 };

  /* table geometry (scene coordinates, 1920 x 1080 frame) */
  const TABLE = { x: 820, y: 236, cw: 76, ch: 84, zeroW: 76, colW: 76, dozenH: 60, outsideH: 60 };
  TABLE.gridX = TABLE.x + TABLE.zeroW; TABLE.gridY = TABLE.y;
  TABLE.gridW = TABLE.cw * 12; TABLE.gridH = TABLE.ch * 3;
  TABLE.w = TABLE.zeroW + TABLE.gridW + TABLE.colW; TABLE.h = TABLE.gridH + TABLE.dozenH + TABLE.outsideH;

  const CHIPS = [
    { value: 1, color: '#f2f2f2', text: '#333' }, { value: 5, color: '#d8262c', text: '#fff' }, { value: 25, color: '#1f8a3a', text: '#fff' },
    { value: 100, color: '#1b1b1f', text: '#fff' }, { value: 500, color: '#7a2ea3', text: '#fff' }
  ];
  const PLAYERS = [
    { id: 'you', name: 'You', color: '#e9c250', text: '#2a1a00', balance: 1000, human: true },
    { id: 'sophia', name: 'Sophia', color: '#2f8ae6', text: '#ffffff', balance: 2400, style: 'outside' },
    { id: 'marcus', name: 'Marcus', color: '#f07d1a', text: '#2a1200', balance: 1800, style: 'inside' },
    { id: 'elena', name: 'Elena', color: '#b44ad6', text: '#ffffff', balance: 3100, style: 'mixed' }
  ];
  const TIMING = { bettingMin: 14, bettingMax: 26, lastBetsAt: 7, spinBallTrack: 6.2, resultHold: 6.5 };

  RL.CONFIG = {
    title: 'GRAND ROULETTE', wheelOrder: WHEEL_ORDER, red: RED, words: WORDS, payout: PAYOUT, limits: LIMITS, table: TABLE, chips: CHIPS, players: PLAYERS, timing: TIMING,
    dealerName: 'Annie', history: 20,
    rules: [
      'European single-zero roulette: 37 pockets, house edge 2.70% on every bet.',
      'Inside bets: straight 35 to 1, split 17 to 1, street and trio 11 to 1, corner and first four 8 to 1, six line 5 to 1.',
      'Outside bets: columns and dozens 2 to 1; red, black, odd, even, 1 to 18 and 19 to 36 even money.',
      'Table limits: 1 to 500 per inside spot, up to 2,500 on outside bets.',
      'Bets close when the dealer calls no more bets; winning bets are paid after the ball settles and the marker is placed.',
      'Play money only. Unofficial recreation for entertainment.'
    ]
  };
  RL.colorOf = colorOf;
  RL.pocketIndex = n => WHEEL_ORDER.indexOf(n);

  if (typeof module !== 'undefined' && module.exports) module.exports = RL;
})(typeof window !== 'undefined' ? window : globalThis);
