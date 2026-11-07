/* ============================================================================
   GRAND ROULETTE — sound: casino ambience, ball on track / cone / frets,
   wheel rumble, chips, table chimes, win fanfares and clip playback for the
   dealer voice. Built on the shared synthesizer (ZEUS.AudioEngine).
   ========================================================================== */
(function (root) {
  'use strict';
  const RL = root.RL, ZEUS = root.ZEUS;
  const A = RL.audio = new ZEUS.AudioEngine();
  const midi = n => 440 * Math.pow(2, (n - 69) / 12);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ---- ambience: murmur of a salon ---- */
  A.startAmbience = function () {
    if (!this.ready || this._amb) return;
    const ctx = this.ctx, t = this.now();
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420; f.Q.value = 0.4;
    const g = ctx.createGain(); g.gain.value = 0;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07; const lg = ctx.createGain(); lg.gain.value = 0.012; lfo.connect(lg); lg.connect(g.gain);
    src.connect(f); f.connect(g); g.connect(this.music); src.start(t); lfo.start(t);
    g.gain.setTargetAtTime(0.035, t, 2);
    this._amb = { src: src, g: g, lfo: lfo, timer: setInterval(() => this._murmur(), 700) };
  };
  A._murmur = function () {
    if (!this.ready || !this._amb) return; const t = this.now();
    if (Math.random() < 0.7) this.noise({ t: t + Math.random() * 0.5, type: 'bandpass', freq: 250 + Math.random() * 500, Q: 3, gain: 0.03 + Math.random() * 0.03, a: 0.04, d: 0.15, s: 0.4, r: 0.2, dur: 0.1 + Math.random() * 0.25, dest: this.music });
    if (Math.random() < 0.25) this.bell(2400 + Math.random() * 2500, t + Math.random() * 0.6, { gain: 0.012, dur: 0.3, dest: this.music });
  };
  A.stopAmbience = function () { const a = this._amb; if (!a) return; clearInterval(a.timer); a.g.gain.setTargetAtTime(0, this.now(), 0.5); a.src.stop(this.now() + 2); a.lfo.stop(this.now() + 2); this._amb = null; };

  /* ---- ball & wheel ---- */
  A.ballLaunch = function () {
    if (!this.ready) return; const t = this.now();
    this.noise({ t: t, type: 'bandpass', freq: 900, freqEnd: 2600, sweep: 0.35, Q: 1, gain: 0.25, a: 0.02, d: 0.3, s: 0.3, r: 0.2, dur: 0.35 });
    this.ballRollStart();
  };
  A.ballRollStart = function () {
    if (!this.ready || this._roll) return; const ctx = this.ctx, t = this.now();
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2200; f.Q.value = 1.4;
    const g = ctx.createGain(); g.gain.value = 0;
    const am = ctx.createGain(); am.gain.value = 1; const lfo = ctx.createOscillator(); lfo.frequency.value = 18; const lg = ctx.createGain(); lg.gain.value = 0.35; lfo.connect(lg); lg.connect(am.gain);
    src.connect(f); f.connect(am); am.connect(g); g.connect(this.sfx); src.start(t); lfo.start(t);
    const rum = ctx.createOscillator(); rum.type = 'sine'; rum.frequency.value = 46; const rg = ctx.createGain(); rg.gain.value = 0; rum.connect(rg); rg.connect(this.sfx); rum.start(t);
    this._roll = { src: src, f: f, g: g, lfo: lfo, rum: rum, rg: rg };
  };
  /* speed: rad/s of the ball, r: normalized radius (1 track .. 0.62 pockets) */
  A.ballRollSet = function (speed, r) {
    if (!this._roll) return; const t = this.now(), s = clamp(speed / 12, 0, 1);
    this._roll.g.gain.setTargetAtTime(0.02 + 0.14 * s, t, 0.08);
    this._roll.f.frequency.setTargetAtTime(900 + 2200 * s + (1 - r) * 800, t, 0.08);
    this._roll.lfo.frequency.setTargetAtTime(4 + 22 * s, t, 0.1);
    this._roll.rg.gain.setTargetAtTime(0.03 + 0.04 * s, t, 0.1);
  };
  A.ballRollStop = function () { const r = this._roll; if (!r) return; const t = this.now(); r.g.gain.setTargetAtTime(0, t, 0.1); r.rg.gain.setTargetAtTime(0, t, 0.3); r.src.stop(t + 0.6); r.lfo.stop(t + 0.6); r.rum.stop(t + 1.2); this._roll = null; };
  A.deflector = function (speed) {
    if (!this.ready) return; const t = this.now();
    this.noise({ t: t, type: 'highpass', freq: 3200, gain: 0.35, dur: 0.008, d: 0.012, s: 0.1, r: 0.02 });
    this.tone({ t: t, freq: 760, freqEnd: 340, sweep: 0.03, gain: 0.18, a: 0.001, d: 0.04, s: 0.05, r: 0.03, dur: 0.04 });
  };
  A.hop = function (n) {
    if (!this.ready) return; const t = this.now();
    this.noise({ t: t, type: 'bandpass', freq: 2600 - n * 200, Q: 2.5, gain: 0.3, dur: 0.012, d: 0.02, s: 0.1, r: 0.02 });
    this.tone({ t: t, freq: 1300 - n * 80, freqEnd: 800, sweep: 0.02, gain: 0.12, a: 0.001, d: 0.03, s: 0.05, r: 0.02, dur: 0.03 });
  };
  A.fret = function () { if (!this.ready) return; this.noise({ t: this.now(), type: 'highpass', freq: 4000, gain: 0.08, dur: 0.005, d: 0.008, s: 0.1, r: 0.01 }); };
  A.seated = function () {
    if (!this.ready) return; const t = this.now();
    for (let k = 0; k < 6; k++) this.noise({ t: t + k * 0.045 * (1 + k * 0.15), type: 'bandpass', freq: 2200, Q: 2, gain: 0.22 * Math.pow(0.7, k), dur: 0.01, d: 0.015, s: 0.1, r: 0.02 });
    this.tone({ t: t, freq: 520, freqEnd: 300, sweep: 0.08, gain: 0.08, a: 0.002, d: 0.08, s: 0.05, r: 0.04, dur: 0.08 });
  };

  /* ---- chips & table ---- */
  A.chipPlace = function () {
    if (!this.ready) return; const t = this.now(), k = 0.95 + Math.random() * 0.1;
    this.tone({ t: t, freq: 2350 * k, gain: 0.09, a: 0.001, d: 0.05, s: 0.02, r: 0.03, dur: 0.05 });
    this.tone({ t: t + 0.012, freq: 3100 * k, gain: 0.05, a: 0.001, d: 0.04, s: 0.02, r: 0.03, dur: 0.04 });
    this.noise({ t: t, type: 'bandpass', freq: 4200, Q: 3, gain: 0.12, dur: 0.01, d: 0.015, s: 0.1, r: 0.02 });
  };
  A.chipStack = function () { if (!this.ready) return; const t = this.now(); this.tone({ t: t, freq: 1800, gain: 0.07, a: 0.001, d: 0.04, s: 0.02, r: 0.03, dur: 0.04 }); this.noise({ t: t, type: 'bandpass', freq: 3500, Q: 3, gain: 0.1, dur: 0.01, d: 0.015, s: 0.1, r: 0.02 }); };
  A.chipSweep = function () {
    if (!this.ready) return; const t = this.now();
    this.noise({ t: t, type: 'bandpass', freq: 1200, freqEnd: 400, sweep: 0.5, Q: 0.8, gain: 0.16, a: 0.03, d: 0.4, s: 0.3, r: 0.2, dur: 0.5 });
    for (let k = 0; k < 7; k++) this.noise({ t: t + 0.05 + Math.random() * 0.45, type: 'bandpass', freq: 3000 + Math.random() * 1500, Q: 3, gain: 0.07, dur: 0.01, d: 0.015, s: 0.1, r: 0.02 });
  };
  A.chipPay = function (n) {
    if (!this.ready) return; const t = this.now(), m = clamp(n, 2, 14);
    for (let k = 0; k < m; k++) { const tt = t + k * 0.07; this.tone({ t: tt, freq: 2100 + Math.random() * 500, gain: 0.07, a: 0.001, d: 0.05, s: 0.02, r: 0.03, dur: 0.05 }); this.noise({ t: tt, type: 'bandpass', freq: 4000, Q: 3, gain: 0.08, dur: 0.01, d: 0.015, s: 0.1, r: 0.02 }); }
  };
  A.noMoreBets = function () { if (!this.ready) return; const t = this.now(); this.bell(midi(88), t, { gain: 0.1, dur: 1.2 }); this.bell(midi(83), t + 0.18, { gain: 0.08, dur: 1.2 }); };
  A.dolly = function () { if (!this.ready) return; const t = this.now(); this.tone({ t: t, freq: 520, freqEnd: 280, sweep: 0.05, gain: 0.2, a: 0.001, d: 0.06, s: 0.05, r: 0.04, dur: 0.06 }); this.noise({ t: t, type: 'lowpass', freq: 900, gain: 0.3, dur: 0.02, d: 0.03, s: 0.1, r: 0.03 }); };
  A.winChime = function (big) {
    if (!this.ready) return; const t = this.now();
    [76, 80, 83, 88].forEach((n, i) => this.bell(midi(n), t + i * 0.08, { gain: 0.1, dur: 1.2 }));
    if (big) { this.duck(3); [[60, 64, 67], [65, 69, 72], [67, 71, 74], [72, 76, 79]].forEach((ch, k) => ch.forEach(n => this.brass(midi(n), t + 0.4 + k * 0.38, k === 3 ? 1.5 : 0.32, 0.09))); }
  };
  A.deny = function () { if (!this.ready) return; this.tone({ t: this.now(), type: 'square', freq: 170, gain: 0.06, a: 0.005, d: 0.12, s: 0.5, r: 0.05, dur: 0.14, filter: { type: 'lowpass', freq: 900 } }); };

  /* ---- voice clips (mp3 decoded through the engine so volume/mute apply) ---- */
  A.clipsRaw = {}; A.clips = {};
  A.preloadClip = function (name, url) {
    if (!root.fetch) return Promise.resolve(false);
    return fetch(url).then(r => (r.ok ? r.arrayBuffer() : null)).then(buf => { if (buf) this.clipsRaw[name] = buf; return !!buf; }).catch(() => false);
  };
  A.hasClip = function (name) { return !!(this.clipsRaw[name] || this.clips[name]); };
  /* returns a promise resolving when playback ends (or immediately when unavailable) */
  A.playClip = function (name, gain) {
    if (!this.ready || !this.hasClip(name)) return Promise.resolve(0);
    const play = ab => new Promise(resolve => {
      const src = this.ctx.createBufferSource(); src.buffer = ab;
      const g = this._g(gain || 0.9, this.sfx, 0.25); src.connect(g); src.onended = () => resolve(ab.duration); src.start();
    });
    if (this.clips[name]) return play(this.clips[name]);
    return this.ctx.decodeAudioData(this.clipsRaw[name].slice(0)).then(ab => { this.clips[name] = ab; return play(ab); }).catch(() => 0);
  };
})(window);
