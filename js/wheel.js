/* ============================================================================
   GRAND ROULETTE — wheel and ball physics.
   The rotor spins counter-clockwise and slowly loses speed; the ball is
   launched clockwise on the outer track, decays with friction, drops down the
   cone past the deflectors, hops across the frets and settles. The outcome is
   decided first; the hop phase is steered so the ball ends in that pocket.
   Angles: radians, canvas convention (clockwise positive, 0 = +x).
   ========================================================================== */
(function (root) {
  'use strict';
  const RL = root.RL || (root.RL = {});
  const TAU = Math.PI * 2, N = 37, STEP = TAU / N;

  function Wheel() {
    this.theta = Math.random() * TAU;      /* rotor angle: pocket 0 centre sits at theta */
    this.omega = -1.1;                      /* rad/s, negative = counter-clockwise */
    this.ball = { state: 'none', phi: 0, r: 1, h: 0, omega: 0, rel: 0 };
    this.target = null; this.result = null;
    this.deflectors = 8;
    this.onEvent = null;                    /* (name, data) -> sound hooks */
    this.t = 0;
  }
  const P = Wheel.prototype;

  P.pocketAngle = function (index) { return this.theta + index * STEP; };
  /* absolute angle -> pocket index under it */
  P.pocketAt = function (phi) { const rel = ((phi - this.theta) % TAU + TAU) % TAU; return Math.round(rel / STEP) % N; };

  P.spin = function (targetIndex, now) {
    this.target = targetIndex; this.result = null; this.t0 = now;
    this.omega = -(2.0 + Math.random() * 0.5);                 /* croupier gives the rotor a push */
    const b = this.ball;
    b.state = 'track'; b.r = 1; b.h = 0; b.phi = Math.random() * TAU;
    b.omega = 10.5 + Math.random() * 2.5; b.tau = 4.3 + Math.random() * 0.6;
    b.dropSpeed = 3.0 + Math.random() * 0.4; b.lastPocket = -1; b.lastDeflector = -1;
    if (this.onEvent) this.onEvent('launch');
  };

  P.update = function (now, dt) {
    this.t += dt;
    /* rotor friction: tends back to a slow idle spin */
    const idle = -0.55;
    this.omega += (idle - this.omega) * Math.min(1, dt * 0.08);
    this.theta = ((this.theta + this.omega * dt) % TAU + TAU) % TAU;
    const b = this.ball;
    if (b.state === 'none' || b.state === 'seated') { if (b.state === 'seated') b.phi = this.theta + this.target * STEP; return; }
    if (b.state === 'track') {
      b.omega *= Math.exp(-dt / b.tau);
      b.phi += b.omega * dt;
      if (b.omega < b.dropSpeed) { b.state = 'drop'; b.dropT = 0; b.dropDur = 0.85 + Math.random() * 0.25; if (this.onEvent) this.onEvent('drop'); }
      return;
    }
    if (b.state === 'drop') {
      b.dropT += dt; const u = Math.min(1, b.dropT / b.dropDur);
      b.r = 1 - 0.38 * (u * u * (3 - 2 * u));
      b.omega *= Math.exp(-dt / 1.4);
      b.phi += b.omega * dt;
      /* deflector strike: eight studs at fixed angles on the slope */
      const dIdx = Math.floor(((b.phi % TAU + TAU) % TAU) / (TAU / this.deflectors));
      if (b.r < 0.86 && b.r > 0.7 && dIdx !== b.lastDeflector) {
        b.lastDeflector = dIdx;
        if (Math.random() < 0.55) { b.h = 0.6 + Math.random() * 0.5; b.hv = 0; b.omega *= 0.6 + Math.random() * 0.3; if (this.onEvent) this.onEvent('deflector', { speed: b.omega }); }
      }
      if (b.h > 0 || b.hv) { b.hv = (b.hv || 0) - 9 * dt; b.h = Math.max(0, b.h + b.hv * dt); if (b.h === 0) b.hv = 0; }
      if (u >= 1) {
        /* enter the pocket ring: plan the steered hop phase */
        b.state = 'hop'; b.hopT = 0; b.hopDur = 1.3 + Math.random() * 0.6;
        const relNow = ((b.phi - this.theta) % TAU + TAU) % TAU;
        const relTarget = this.target * STEP;
        let ahead = ((relTarget - relNow) % TAU + TAU) % TAU;       /* clockwise distance to the target pocket in rotor frame */
        ahead += STEP * (N * Math.floor(Math.random() * 0)) ;        /* keep within one turn */
        if (ahead < 3 * STEP) ahead += TAU;                          /* always skip a few pockets first */
        b.relStart = relNow; b.relSpan = ahead; b.hops = 3 + Math.floor(Math.random() * 3); b.lastHop = -1;
      }
      return;
    }
    if (b.state === 'hop') {
      b.hopT += dt; const u = Math.min(1, b.hopT / b.hopDur);
      const e = 1 - Math.pow(1 - u, 2.6);                              /* ease out: fast then slow */
      b.rel = b.relStart + b.relSpan * e;
      b.phi = this.theta + b.rel;
      b.r = 0.62 - 0.03 * (1 - u);
      const hopPhase = u * b.hops;
      b.h = Math.abs(Math.sin(hopPhase * Math.PI)) * (1 - u) * 0.7;
      const hopIdx = Math.floor(hopPhase);
      if (hopIdx !== b.lastHop) { b.lastHop = hopIdx; if (this.onEvent && u < 0.98) this.onEvent('hop', { n: hopIdx, u: u }); }
      const pocket = this.pocketAt(b.phi);
      if (pocket !== b.lastPocket) { b.lastPocket = pocket; if (this.onEvent && u > 0.3) this.onEvent('fret', { u: u }); }
      if (u >= 1) {
        b.state = 'seated'; b.h = 0; b.r = 0.62; b.phi = this.theta + this.target * STEP;
        this.result = this.target;
        if (this.onEvent) this.onEvent('seated', { number: RL.CONFIG.wheelOrder[this.target] });
      }
    }
  };
  P.reset = function () { this.ball.state = 'none'; this.result = null; };

  RL.Wheel = Wheel;
  RL.WHEEL_STEP = STEP;
})(window);
