/* ============================================================================
   GRAND ROULETTE — bootstrap, frame loop, test hooks.
   ?force=<0-36> forces the winning number · ?fast=1 short rounds · ?mute=1
   ========================================================================== */
(function (root) {
  'use strict';
  const RL = root.RL, C = RL.CONFIG;
  root.addEventListener('load', () => {
    const q = new URLSearchParams(root.location.search);
    if (q.get('force') != null) RL.DEBUG_NUMBER = parseInt(q.get('force'), 10);
    const canvas = document.getElementById('game');
    const game = new RL.Game();
    if (q.get('fast')) Object.assign(game.timing, { bettingMin: 4, bettingMax: 7, lastBetsAt: 3, resultHold: 3.5 });
    const renderer = new RL.Renderer(canvas, game); game.renderer = renderer;
    const dealer = new RL.Dealer({ video: document.getElementById('dealer-video'), img: document.getElementById('dealer-img'), caption: document.getElementById('caption') });
    game.dealer = dealer;
    const ui = new RL.UI(game, renderer);
    RL.game = game; RL.renderer = renderer; RL.dealer = dealer; RL.ui = ui;
    ui.buildSeats(); ui.buildHelp();
    /* voice clips */
    Object.keys(RL.LINES).forEach(k => RL.audio.preloadClip(k, 'assets/audio/' + k + '.mp3'));
    dealer.init();
    renderer.loadImages({ bg: 'assets/bg/salon.jpg', logo: 'assets/logo.png' }).then(() => ui.assetsLoaded());

    RL.timeOffset = 0;
    const clock = () => performance.now() / 1000 + RL.timeOffset;
    let last = clock();
    function tick(now, dt, draw) { game.update(now, dt); root.ZEUS.fx.update(dt); renderer.update(dt); if (draw) { renderer.draw(now); ui.refresh(); } }
    function frame() { const now = clock(), dt = Math.min(0.05, Math.max(0, now - last)); last = now; tick(now, dt, true); requestAnimationFrame(frame); }
    requestAnimationFrame(frame);
    RL.step = function (seconds) { const h = 1 / 60, n = Math.max(1, Math.round(seconds / h)); for (let i = 0; i < n; i++) { RL.timeOffset += h; const now = clock(); last = now; tick(now, h, i === n - 1); } };
    document.addEventListener('visibilitychange', () => { if (!document.hidden && RL.audio.ctx) RL.audio.ctx.resume(); });
  });
})(window);
