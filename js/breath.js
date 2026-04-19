/* ============================================================
   BLOOM BREAK — 60-second practice.
   Evidence: paced slow breathing at ~6 breaths/min is the sweet
   spot for vagal tone + parasympathetic activation (Zaccaro et al,
   2018; Russo et al, 2017). We use 4s in / 6s out × 6 breaths = 60s.
   Single entry point: the #breath-open button. Event delegation
   means we work regardless of when React renders it.
   ============================================================ */

(function () {
  'use strict';

  var PRM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var running = false;
  var rafHandle = null;

  var CYCLES = 6;
  var IN_MS = 4000;
  var OUT_MS = 6000;
  var CYCLE_MS = IN_MS + OUT_MS;
  var TOTAL_MS = CYCLES * CYCLE_MS;

  function $(id) { return document.getElementById(id); }

  function setDots(currentIdx) {
    var dots = document.querySelectorAll('#breath-dots .breath-dot');
    dots.forEach(function (d, i) {
      d.classList.remove('is-active', 'is-done');
      if (i < currentIdx) d.classList.add('is-done');
      else if (i === currentIdx) d.classList.add('is-active');
    });
    var bar = $('breath-dots');
    if (bar) bar.setAttribute('aria-valuenow', Math.max(0, currentIdx));
  }

  function open() {
    var overlay = $('breath-overlay');
    var blossom = overlay && overlay.querySelector('.breath-blossom');
    var cue = $('breath-cue');
    var count = $('breath-count');
    var start = $('breath-start');
    if (!overlay || !blossom) return;
    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    cue.textContent = 'Ready when you are.';
    count.textContent = '';
    start.textContent = 'Begin';
    running = false;
    blossom.style.transform = '';
    setDots(-1);
    setTimeout(function () { start.focus(); }, 100);
  }

  function close() {
    var overlay = $('breath-overlay');
    stop();
    if (!overlay) return;
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function stop() {
    running = false;
    if (rafHandle) { cancelAnimationFrame(rafHandle); rafHandle = null; }
    var blossom = document.querySelector('#breath-overlay .breath-blossom');
    if (blossom) blossom.style.transform = '';
  }

  function run() {
    var blossom = document.querySelector('#breath-overlay .breath-blossom');
    var cue = $('breath-cue');
    var count = $('breath-count');
    var start = $('breath-start');
    if (running) { stop(); start.textContent = 'Begin'; cue.textContent = 'Paused. Tap to begin again.'; return; }
    running = true;
    start.textContent = 'Pause';
    var t0 = performance.now();
    var stopAt = t0 + TOTAL_MS;
    var lastCycle = -1;

    function tick(now) {
      if (!running) return;
      if (now >= stopAt) { finish(); return; }
      var into = now - t0;
      var cycleIdx = Math.floor(into / CYCLE_MS);
      var inCycle = into - cycleIdx * CYCLE_MS;
      var label, scale;
      if (inCycle < IN_MS) {
        label = 'breathe in';
        var t = inCycle / IN_MS;
        scale = 1 + 0.55 * easeOut(t);
      } else {
        label = 'breathe out';
        var t2 = (inCycle - IN_MS) / OUT_MS;
        scale = 1.55 - 0.55 * easeIn(t2);
      }
      // Use translate3d to force GPU compositing so scale is buttery even on low-end devices.
      blossom.style.transform = 'translate3d(0,0,0) scale(' + scale.toFixed(4) + ')';
      cue.textContent = label;
      if (cycleIdx !== lastCycle) {
        lastCycle = cycleIdx;
        setDots(cycleIdx);
        count.textContent = 'Breath ' + (cycleIdx + 1) + ' of ' + CYCLES;
      }
      rafHandle = requestAnimationFrame(tick);
    }

    if (PRM) {
      cue.textContent = 'breathe with me';
      count.textContent = '';
      setDots(CYCLES - 1);
      setTimeout(finish, TOTAL_MS);
    } else {
      rafHandle = requestAnimationFrame(tick);
    }
  }

  function easeOut(t) { return 1 - Math.pow(1 - t, 2); }
  function easeIn(t) { return t * t; }

  function finish() {
    running = false;
    if (rafHandle) { cancelAnimationFrame(rafHandle); rafHandle = null; }
    var blossom = document.querySelector('#breath-overlay .breath-blossom');
    var cue = $('breath-cue');
    var count = $('breath-count');
    var start = $('breath-start');
    if (blossom) blossom.style.transform = 'translate3d(0,0,0) scale(1.1)';
    if (cue) cue.textContent = 'thanks for showing up';
    if (count) count.textContent = 'one whole minute of you';
    if (start) start.textContent = 'Do it again';
    // All 6 dots glow at completion
    document.querySelectorAll('#breath-dots .breath-dot').forEach(function (d) {
      d.classList.remove('is-active');
      d.classList.add('is-done');
    });
  }

  // ---- event delegation so React's async render is irrelevant ----
  document.addEventListener('click', function (e) {
    var target = e.target;
    var opener = target.closest && target.closest('#breath-open');
    if (opener) { open(); setTimeout(run, 450); return; }
    var starter = target.closest && target.closest('#breath-start');
    if (starter) { run(); return; }
    var closer = target.closest && target.closest('#breath-close');
    if (closer) { close(); return; }
    // backdrop click
    var overlay = $('breath-overlay');
    if (overlay && overlay.classList.contains('is-open') && target === overlay) {
      close();
    }
  });

  document.addEventListener('keydown', function (e) {
    var overlay = $('breath-overlay');
    if (overlay && overlay.classList.contains('is-open') && e.key === 'Escape') close();
  });
})();
