/* ============================================================================
   GRAND ROULETTE — the dealer. A live-stream style panel: lip-synced video
   segments for the table phrases, generated voice clips for every number
   call, captions, and a queue so lines never overlap. Degrades gracefully to
   the still portrait + audio, and to captions only.
   ========================================================================== */
(function (root) {
  'use strict';
  const RL = root.RL, C = RL.CONFIG;
  const A = () => RL.audio;

  const LINES = {
    greet: 'Welcome to the table, everyone. Place your bets, please.',
    placebets: 'Place your bets, please.',
    lastbets: 'Last bets, please.',
    nomore: 'No more bets.',
    winners: 'Congratulations to our winners!',
    nowin: 'No winners this time. Better luck on the next spin.',
    youwin: 'Well played! You win.',
    sophia: 'Nicely done, Sophia.',
    marcus: 'Nicely done, Marcus.',
    elena: 'Nicely done, Elena.',
    spinning: 'Spinning.',
    thanks: 'Thank you for playing. Good luck, everyone.',
    inplay: 'The ball is in play.',
    closed: 'Bets are closed. Good luck.',
    bigwin: 'A big win on the table! Congratulations.'
  };
  for (let n = 0; n <= 36; n++) {
    const w = C.words[n]; LINES['n' + n] = w.charAt(0).toUpperCase() + w.slice(1) + '. ' + (n === 0 ? 'Green' : RL.colorOf(n) === 'red' ? 'Red' : 'Black') + '.';
  }
  /* phrases carried by the two lip-synced videos, in recording order */
  const VIDEOS = [
    { file: 'assets/dealer/talk1.mp4', keys: ['greet', 'placebets', 'lastbets', 'nomore', 'winners', 'nowin'] },
    { file: 'assets/dealer/talk2.mp4', keys: ['youwin', 'sophia', 'marcus', 'elena', 'spinning', 'thanks'] }
  ];

  function Dealer(els) {
    this.el = els;                       /* { video, img, caption, status } */
    this.queue = []; this.speaking = false; this.current = null;
    this.segments = {};                  /* key -> { file, start, end } */
    this.videoReady = {}; this.lastSaid = {};
    this.onLine = null;
  }
  const P = Dealer.prototype;

  P.init = function () {
    VIDEOS.forEach(v => this._probeVideo(v));
    const vid = this.el.video;
    if (vid) {
      vid.muted = true; vid.loop = false; vid.playsInline = true;
      vid.addEventListener('timeupdate', () => this._tick());
      vid.addEventListener('error', () => { vid.style.display = 'none'; if (this.el.img) this.el.img.style.display = 'block'; });
    }
  };
  /* find speech segments in a video's audio track by silence detection */
  P._probeVideo = function (v) {
    if (!root.fetch) return;
    fetch(v.file, { method: 'GET' }).then(r => (r.ok ? r.arrayBuffer() : null)).then(buf => {
      if (!buf) return;
      v.buffer = buf; this.videoReady[v.file] = true;
      if (!this.idleFile) { this.idleFile = v.file; this._showIdle(); }
      const tryDecode = () => {
        const a = A(); if (!a.ctx) { setTimeout(tryDecode, 500); return; }
        a.ctx.decodeAudioData(buf.slice(0)).then(ab => this._segment(v, ab)).catch(() => this._segmentEqual(v, null));
      };
      tryDecode();
    }).catch(() => {});
  };
  P._segment = function (v, ab) {
    const data = ab.getChannelData(0), sr = ab.sampleRate, win = Math.floor(sr * 0.02), n = Math.floor(data.length / win), env = new Float32Array(n);
    let peak = 0;
    for (let i = 0; i < n; i++) { let s = 0; for (let j = 0; j < win; j++) { const x = data[i * win + j]; s += x * x; } env[i] = Math.sqrt(s / win); if (env[i] > peak) peak = env[i]; }
    const thr = peak * 0.08, regions = []; let inR = false, start = 0, quiet = 0;
    for (let i = 0; i < n; i++) {
      if (env[i] > thr) { if (!inR) { inR = true; start = i; } quiet = 0; }
      else if (inR) { quiet++; if (quiet > 16) { regions.push([start * 0.02, (i - quiet) * 0.02 + 0.12]); inR = false; } }
    }
    if (inR) regions.push([start * 0.02, n * 0.02]);
    /* merge until we have as many regions as phrases */
    while (regions.length > v.keys.length) { let bi = 0, bg = 1e9; for (let i = 0; i < regions.length - 1; i++) { const gap = regions[i + 1][0] - regions[i][1]; if (gap < bg) { bg = gap; bi = i; } } regions.splice(bi, 2, [regions[bi][0], regions[bi + 1][1]]); }
    if (regions.length === v.keys.length) { v.keys.forEach((k, i) => { this.segments[k] = { file: v.file, start: Math.max(0, regions[i][0] - 0.08), end: regions[i][1] + 0.1 }; }); this.tail = { file: v.file, start: regions[regions.length - 1][1] + 0.2, end: ab.duration }; }
    else this._segmentEqual(v, ab.duration);
  };
  P._segmentEqual = function (v, dur) { if (!dur) return; const seg = (dur - 2.5) / v.keys.length; v.keys.forEach((k, i) => { this.segments[k] = { file: v.file, start: i * seg, end: (i + 1) * seg }; }); };
  P._showIdle = function () {
    const vid = this.el.video; if (!vid || !this.idleFile) return;
    if (vid.dataset.file !== this.idleFile) { vid.src = this.idleFile; vid.dataset.file = this.idleFile; }
    vid.muted = true; this.idle = true;
    const t = this.tail && this.tail.file === this.idleFile ? this.tail : null;
    this.idleRange = t && t.end - t.start > 0.8 ? t : { start: 0, end: 1.6 };
    vid.currentTime = this.idleRange.start; vid.play().catch(() => {});
    if (this.el.img) this.el.img.style.display = 'none'; vid.style.display = 'block';
  };
  P._tick = function () {
    const vid = this.el.video; if (!vid) return;
    if (this.idle && this.idleRange) {
      if (vid.currentTime >= this.idleRange.end - 0.05 || vid.ended) { vid.currentTime = this.idleRange.start; vid.play().catch(() => {}); }
    } else if (this.current && this.current.seg && vid.currentTime >= this.current.seg.end) this._finish();
  };

  P.say = function (key, o) {
    o = o || {};
    if (!LINES[key]) return;
    if (o.dedupe && this.lastSaid[key] && performance.now() - this.lastSaid[key] < o.dedupe * 1000) return;
    this.lastSaid[key] = performance.now();
    if (o.priority) this.queue.unshift({ key: key }); else this.queue.push({ key: key });
    if (this.queue.length > 4) this.queue.length = 4;
    this._next();
  };
  P._next = function () {
    if (this.speaking || !this.queue.length) return;
    const item = this.queue.shift(); this.speaking = true; this.current = item;
    const text = LINES[item.key];
    this._caption(text);
    if (this.onLine) this.onLine(item.key, text);
    const seg = this.segments[item.key], vid = this.el.video, a = A();
    if (seg && this.videoReady[seg.file] && vid && !a.muted) {
      item.seg = seg; this.idle = false;
      if (vid.dataset.file !== seg.file) { vid.src = seg.file; vid.dataset.file = seg.file; }
      vid.muted = false; vid.volume = Math.min(1, a.volume * 1.1);
      vid.currentTime = seg.start; vid.play().catch(() => this._finish());
      this.guard = setTimeout(() => this._finish(), (seg.end - seg.start + 1.5) * 1000);
      return;
    }
    /* audio-only line: play the clip while the video mouths a talking segment */
    this._talkLoop(true);
    const dur = Math.max(1.2, text.length * 0.055);
    if (a.hasClip(item.key) && !a.muted) a.playClip(item.key).then(() => this._finish());
    else setTimeout(() => this._finish(), dur * 1000);
  };
  P._talkLoop = function (on) {
    const vid = this.el.video; if (!vid || !this.idleFile) return;
    if (on) { const seg = this.segments.placebets || this.segments.greet; if (seg && this.videoReady[seg.file]) { this.idle = true; if (vid.dataset.file !== seg.file) { vid.src = seg.file; vid.dataset.file = seg.file; } vid.muted = true; this.idleRange = { start: seg.start, end: seg.end }; vid.currentTime = seg.start; vid.play().catch(() => {}); } }
  };
  P._finish = function () {
    clearTimeout(this.guard); this.speaking = false; this.current = null;
    const vid = this.el.video; if (vid) vid.muted = true;
    this._showIdle();
    setTimeout(() => { if (!this.speaking) this._caption(''); }, 900);
    setTimeout(() => this._next(), 250);
  };
  P._caption = function (text) { if (this.el.caption) { this.el.caption.textContent = text; this.el.caption.classList.toggle('show', !!text); } };
  P.numberKey = n => 'n' + n;

  RL.Dealer = Dealer; RL.LINES = LINES; RL.DEALER_VIDEOS = VIDEOS;
})(window);
