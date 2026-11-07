/* ============================================================================
   GRAND ROULETTE — betting layout: every bet spot of a European table with
   its position, covered numbers and payout; nearest-spot hit testing; bet
   evaluation. Pure data + maths (also usable from node tools).
   ========================================================================== */
(function (root) {
  'use strict';
  const RL = root.RL || (root.RL = {});
  const C = RL.CONFIG, T = C.table, P = C.payout;

  /* number at grid column c (0..11) and row r (0 top .. 2 bottom) */
  const numAt = (c, r) => 3 * c + (3 - r);
  const cellCenter = (c, r) => ({ x: T.gridX + (c + 0.5) * T.cw, y: T.gridY + (r + 0.5) * T.ch });

  function buildSpots() {
    const spots = [];
    const add = (type, x, y, numbers, label) => spots.push({ id: type + ':' + numbers.join('-'), type: type, x: x, y: y, numbers: numbers, payout: P[type], label: label || null, inside: !(type === 'column' || type === 'dozen' || ['low', 'high', 'red', 'black', 'even', 'odd'].includes(type)) });
    /* straights */
    add('straight', T.x + T.zeroW / 2, T.gridY + T.gridH / 2, [0], '0');
    for (let c = 0; c < 12; c++) for (let r = 0; r < 3; r++) { const p = cellCenter(c, r); add('straight', p.x, p.y, [numAt(c, r)], String(numAt(c, r))); }
    /* splits: horizontal neighbours (n, n+3) and vertical neighbours (n, n-1) */
    for (let c = 0; c < 11; c++) for (let r = 0; r < 3; r++) add('split', T.gridX + (c + 1) * T.cw, T.gridY + (r + 0.5) * T.ch, [numAt(c, r), numAt(c + 1, r)].sort((a, b) => a - b));
    for (let c = 0; c < 12; c++) for (let r = 0; r < 2; r++) add('split', T.gridX + (c + 0.5) * T.cw, T.gridY + (r + 1) * T.ch, [numAt(c, r + 1), numAt(c, r)].sort((a, b) => a - b));
    for (let r = 0; r < 3; r++) add('split', T.gridX, T.gridY + (r + 0.5) * T.ch, [0, numAt(0, r)]);
    /* streets (a column of three) on the bottom edge, six lines between columns */
    for (let c = 0; c < 12; c++) add('street', T.gridX + (c + 0.5) * T.cw, T.gridY + T.gridH, [numAt(c, 2), numAt(c, 1), numAt(c, 0)]);
    for (let c = 0; c < 11; c++) add('sixline', T.gridX + (c + 1) * T.cw, T.gridY + T.gridH, [numAt(c, 2), numAt(c, 1), numAt(c, 0), numAt(c + 1, 2), numAt(c + 1, 1), numAt(c + 1, 0)]);
    /* corners */
    for (let c = 0; c < 11; c++) for (let r = 0; r < 2; r++) add('corner', T.gridX + (c + 1) * T.cw, T.gridY + (r + 1) * T.ch, [numAt(c, r + 1), numAt(c, r), numAt(c + 1, r + 1), numAt(c + 1, r)].sort((a, b) => a - b));
    /* zero trios and first four */
    add('trio', T.gridX, T.gridY + 2 * T.ch, [0, 1, 2]);
    add('trio', T.gridX, T.gridY + T.ch, [0, 2, 3]);
    add('first4', T.gridX, T.gridY + T.gridH, [0, 1, 2, 3]);
    /* columns (2 to 1) */
    for (let r = 0; r < 3; r++) { const nums = []; for (let c = 0; c < 12; c++) nums.push(numAt(c, r)); add('column', T.gridX + T.gridW + T.colW / 2, T.gridY + (r + 0.5) * T.ch, nums, '2 TO 1'); }
    /* dozens */
    for (let d = 0; d < 3; d++) { const nums = []; for (let n = d * 12 + 1; n <= d * 12 + 12; n++) nums.push(n); add('dozen', T.gridX + (d + 0.5) * (T.gridW / 3), T.gridY + T.gridH + T.dozenH / 2, nums, ['1ST 12', '2ND 12', '3RD 12'][d]); }
    /* even-money */
    const oy = T.gridY + T.gridH + T.dozenH + T.outsideH / 2, ow = T.gridW / 6;
    const ranges = [['low', n => n >= 1 && n <= 18, '1 TO 18'], ['even', n => n > 0 && n % 2 === 0, 'EVEN'], ['red', n => C.red.has(n), 'RED'], ['black', n => n > 0 && !C.red.has(n), 'BLACK'], ['odd', n => n % 2 === 1, 'ODD'], ['high', n => n >= 19, '19 TO 36']];
    ranges.forEach(([type, pred, label], i) => { const nums = []; for (let n = 1; n <= 36; n++) if (pred(n)) nums.push(n); add(type, T.gridX + (i + 0.5) * ow, oy, nums, label); });
    return spots;
  }
  const SPOTS = buildSpots();
  const SPOT_BY_ID = {}; SPOTS.forEach(s => { SPOT_BY_ID[s.id] = s; });

  /* rectangles of the outside/column/dozen cells for drawing + containment */
  function outsideRects() {
    const rects = [];
    for (let r = 0; r < 3; r++) rects.push({ spot: SPOT_BY_ID['column:' + SPOTS.filter(s => s.type === 'column')[r].numbers.join('-')], x: T.gridX + T.gridW, y: T.gridY + r * T.ch, w: T.colW, h: T.ch });
    SPOTS.filter(s => s.type === 'dozen').forEach((s, d) => rects.push({ spot: s, x: T.gridX + d * T.gridW / 3, y: T.gridY + T.gridH, w: T.gridW / 3, h: T.dozenH }));
    ['low', 'even', 'red', 'black', 'odd', 'high'].forEach((type, i) => rects.push({ spot: SPOTS.find(s => s.type === type), x: T.gridX + i * T.gridW / 6, y: T.gridY + T.gridH + T.dozenH, w: T.gridW / 6, h: T.outsideH }));
    return rects;
  }
  const OUTSIDE_RECTS = outsideRects();

  /* which spot does a click at scene (x, y) mean? */
  function hitTest(x, y) {
    for (const rc of OUTSIDE_RECTS) if (x >= rc.x && x < rc.x + rc.w && y >= rc.y && y < rc.y + rc.h) return rc.spot;
    const inGrid = x >= T.x - 10 && x <= T.gridX + T.gridW + 10 && y >= T.gridY - 10 && y <= T.gridY + T.gridH + 14;
    if (!inGrid) return null;
    let best = null, bestD = 1e9;
    for (const s of SPOTS) {
      if (!s.inside) continue;
      const d = Math.hypot(s.x - x, s.y - y);
      /* straights win ties inside the cell body; line bets need to be close to the line */
      const bias = s.type === 'straight' ? 0 : 6;
      if (d + bias < bestD) { bestD = d + bias; best = s; }
    }
    if (best && best.type !== 'straight' && bestD > 22) best = SPOTS.find(s => s.type === 'straight' && Math.abs(s.x - x) <= T.cw / 2 && Math.abs(s.y - y) <= T.ch / 2) || best;
    return best;
  }

  /* bets: [{spotId, playerId, amount}] -> result per bet */
  function settle(bets, number) {
    return bets.map(b => {
      const s = SPOT_BY_ID[b.spotId];
      const win = s.numbers.indexOf(number) >= 0;
      return { bet: b, spot: s, win: win, payout: win ? b.amount * s.payout : 0, returned: win ? b.amount * (s.payout + 1) : 0 };
    });
  }

  RL.table = { spots: SPOTS, byId: SPOT_BY_ID, outsideRects: OUTSIDE_RECTS, hitTest: hitTest, settle: settle, numAt: numAt, cellCenter: cellCenter };
  if (typeof module !== 'undefined' && module.exports) module.exports = RL;
})(typeof window !== 'undefined' ? window : globalThis);
