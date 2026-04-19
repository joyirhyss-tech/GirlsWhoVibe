/* ============================================================
   GWV Interactions — makes the site feel alive.
   Runs after React mounts. Everything respects prefers-reduced-motion
   and hover-capable environment. No dependencies except canvas-confetti.
   ============================================================ */

(function () {
  'use strict';

  var PRM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var HOVER = window.matchMedia('(hover: hover)').matches;

  // ---------- helpers ----------
  function qs(s, r) { return (r || document).querySelector(s); }
  function qsa(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }

  function pollFor(sel, cb, max) {
    var tries = 0;
    var timer = setInterval(function () {
      tries += 1;
      var el = document.querySelector(sel);
      if (el) { clearInterval(timer); cb(el); }
      else if (tries > (max || 80)) { clearInterval(timer); }
    }, 80);
  }

  // ---------- 1. scroll ribbon ----------
  (function scrollRibbon() {
    if (PRM) return;
    var ribbon = document.createElement('div');
    ribbon.className = 'scroll-ribbon';
    ribbon.setAttribute('aria-hidden', 'true');
    document.body.appendChild(ribbon);
    var ticking = false;
    function update() {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      var pct = max > 0 ? (window.scrollY / max) * 100 : 0;
      ribbon.style.width = pct + '%';
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { requestAnimationFrame(update); ticking = true; }
    }, { passive: true });
    update();
  })();

  // ---------- 2. cursor aurora blob + sparkle trail ----------
  (function cursorEffects() {
    if (PRM || !HOVER) return;

    var aurora = document.createElement('div');
    aurora.className = 'cursor-aurora';
    aurora.setAttribute('aria-hidden', 'true');
    document.body.appendChild(aurora);

    var tx = window.innerWidth / 2;
    var ty = window.innerHeight / 2;
    var cx = tx, cy = ty;
    var lastSpark = 0;
    var moveSeen = false;

    function animate() {
      cx += (tx - cx) * 0.12;
      cy += (ty - cy) * 0.12;
      aurora.style.transform = 'translate3d(' + (cx - 210) + 'px,' + (cy - 210) + 'px,0)';
      requestAnimationFrame(animate);
    }
    animate();

    window.addEventListener('mousemove', function (e) {
      tx = e.clientX; ty = e.clientY;
      if (!moveSeen) {
        aurora.classList.add('is-active');
        moveSeen = true;
      }
      var now = performance.now();
      if (now - lastSpark > 60) {
        lastSpark = now;
        spawnSparkle(e.clientX, e.clientY);
      }
    }, { passive: true });

    window.addEventListener('mouseleave', function () {
      aurora.classList.remove('is-active');
      moveSeen = false;
    });

    function spawnSparkle(x, y) {
      var s = document.createElement('div');
      s.className = 'sparkle-particle';
      s.style.left = x + 'px';
      s.style.top = y + 'px';
      document.body.appendChild(s);
      setTimeout(function () { s.remove(); }, 950);
    }
  })();

  // ---------- 3. hero verb cycle ----------
  pollFor('#hero h1', function (h1) {
    if (PRM) return; // still show first word, just don't animate
    var verbs = ['Build', 'Design', 'Ship', 'Invent', 'Prototype', 'Code', 'Make'];
    var text = h1.textContent;
    var firstSpace = text.indexOf(' ');
    if (firstSpace < 1) return;
    var rest = text.slice(firstSpace);
    h1.innerHTML = '';
    var verbSpan = document.createElement('span');
    verbSpan.className = 'verb-cycle';
    verbSpan.setAttribute('aria-live', 'polite');
    verbSpan.setAttribute('aria-label', 'Build, design, ship, invent');
    var currentWord = document.createElement('span');
    currentWord.className = 'verb-in';
    currentWord.textContent = verbs[0];
    verbSpan.appendChild(currentWord);

    var restNode = document.createTextNode(rest);
    // But "rest" ends with "you wish existed." which we already styled. Re-render:
    // rest is " the future you wish existed." so we need to split at "you wish existed."
    // Because the original had nested <span class="hand">, but h1.textContent flattened it,
    // we re-wrap manually.
    var restText = rest;
    var hintIdx = restText.indexOf('you wish existed');
    h1.appendChild(verbSpan);
    if (hintIdx > -1) {
      h1.appendChild(document.createTextNode(restText.slice(0, hintIdx)));
      var hand = document.createElement('span');
      hand.className = 'hand hand-underline';
      hand.style.fontSize = '1.05em';
      hand.textContent = restText.slice(hintIdx);
      h1.appendChild(hand);
    } else {
      h1.appendChild(document.createTextNode(restText));
    }

    var idx = 0;
    setInterval(function () {
      idx = (idx + 1) % verbs.length;
      var next = verbs[idx];
      var out = currentWord;
      out.className = 'verb-out';
      var inNode = document.createElement('span');
      inNode.className = 'verb-in';
      inNode.textContent = next;
      verbSpan.insertBefore(inNode, verbSpan.firstChild);
      currentWord = inNode;
      setTimeout(function () { out.remove(); }, 400);
    }, 2400);
  });

  // ---------- 4. stream card magnetism + pick ripple ----------
  // Seat counts intentionally NOT shown: 15-per-stream is the cap; nothing fake gets painted.

  pollFor('.stream-card', function () {
    var cards = qsa('.stream-card');
    cards.forEach(function (card) {
      var badge = document.createElement('div');
      badge.className = 'seat-badge';
      badge.setAttribute('aria-label', '15 seats per stream, first come first served');
      badge.textContent = '15 seats · first come';
      card.appendChild(badge);

      if (!PRM && HOVER) {
        card.addEventListener('mousemove', function (e) {
          var rect = card.getBoundingClientRect();
          var mx = ((e.clientX - rect.left) / rect.width) * 100;
          var my = ((e.clientY - rect.top) / rect.height) * 100;
          card.style.setProperty('--mx', mx + '%');
          card.style.setProperty('--my', my + '%');
          var ry = ((e.clientX - rect.left) / rect.width - 0.5) * 8;
          var rx = ((e.clientY - rect.top) / rect.height - 0.5) * -8;
          card.style.setProperty('--rx', rx + 'deg');
          card.style.setProperty('--ry', ry + 'deg');
        });
        card.addEventListener('mouseleave', function () {
          card.style.setProperty('--rx', '0deg');
          card.style.setProperty('--ry', '0deg');
        });
      }

      card.addEventListener('click', function (e) {
        if (PRM) return;
        var rect = card.getBoundingClientRect();
        var r = document.createElement('span');
        r.className = 'pick-ripple';
        var size = Math.max(rect.width, rect.height) * 0.2;
        r.style.width = size + 'px';
        r.style.height = size + 'px';
        var x = e.clientX ? (e.clientX - rect.left) : rect.width / 2;
        var y = e.clientY ? (e.clientY - rect.top) : rect.height / 2;
        r.style.left = x + 'px';
        r.style.top = y + 'px';
        card.appendChild(r);
        setTimeout(function () { r.remove(); }, 820);
      });
    });
  });

  // ---------- 5. 6-week timeline: scroll-lit + tap-to-peek ----------
  var WEEK_PEEKS = [
    { title: 'FEEL', items: ['Feelings wheel + 12 Principles', 'Problem-spotting journal', 'Pick one real problem to own'] },
    { title: 'FRAME', items: ['Magic-wand visioning', 'User journey + anti-goals', '1-page spec you could hand to anyone'] },
    { title: 'FLOW 1', items: ['Claude prompting fundamentals', 'Lovable onboarding + first prototype', 'The Basic Human Decency Framework'] },
    { title: 'FLOW 2', items: ['Iterate with AI partner', 'Canva + Figma UI polish', 'Deploy to Netlify'] },
    { title: 'FIX', items: ['Peer-test with Roo feedback tool', 'Receive feedback like an adult', 'Bug triage + decision tree'] },
    { title: 'FORWARD', items: ['Final polish + Demo Day', 'Cross-stream showcase', 'Ready-for-adulthood reflection + intern invite'] },
  ];

  pollFor('.week-cell', function () {
    var cells = qsa('.week-cell');
    cells.forEach(function (cell, i) {
      var peek = document.createElement('div');
      peek.className = 'week-peek';
      var data = WEEK_PEEKS[i];
      if (data) {
        data.items.forEach(function (item) {
          var row = document.createElement('div');
          row.className = 'week-peek-item';
          row.textContent = item;
          peek.appendChild(row);
        });
      }
      cell.appendChild(peek);
      var hint = document.createElement('div');
      hint.className = 'week-toggle-hint';
      cell.appendChild(hint);

      cell.setAttribute('role', 'button');
      cell.setAttribute('tabindex', '0');
      cell.setAttribute('aria-expanded', 'false');

      function toggle() {
        var open = cell.classList.toggle('is-open');
        cell.setAttribute('aria-expanded', open ? 'true' : 'false');
      }
      cell.addEventListener('click', toggle);
      cell.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
      });
    });

    // scroll-lit progression
    var rail = qs('.week-rail');
    function updateRail() {
      var lit = qsa('.week-cell.is-lit').length;
      var pct = (lit / cells.length) * 100;
      if (rail) rail.style.setProperty('--rail-progress', pct + '%');
    }
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.classList.add('is-lit');
            updateRail();
            io.unobserve(e.target);
          }
        });
      }, { threshold: 0.35, rootMargin: '0px 0px -8% 0px' });
      cells.forEach(function (c) { io.observe(c); });
    } else {
      cells.forEach(function (c) { c.classList.add('is-lit'); });
      updateRail();
    }
  });

  // ---------- 6. toolkit cards — tappable "cases" ----------
  var TOOL_USES = {
    'Claude':          'Week 1-6. Your co-pilot for every build. You write the intent, Claude writes the code.',
    'Lovable':         'Week 3-4. Describe your app in plain English. Lovable scaffolds the whole thing.',
    'Canva':           'Week 4. Brand boards, hero images, and social posts for your demo day.',
    'Figma':           'Week 2-4. Sketch screens, prototype flows, hand off visuals to AI for the build.',
    'Netlify':         'Week 4-6. One-click deploys. Your build goes live at your own URL.',
    'Roo':             'Week 5. Peer-test. Real users click and break things, Roo collects the feedback.',
    'GitHub':          'Week 3-6. Where your code lives forever. Read first, write when ready.',
    'Human Decency':   'Every week. The ethics check you run before shipping anything for another human.',
    'The Good Skill':  'Week 2. Research tool that puts marginalized voices first in whatever you build.',
    'WellBEing Snapshot': 'Week 1. Private 5-minute self-check-in. Baseline where you are.',
    'Sources of Wholeness': 'Week 6. Re-run after demo day. Watch what shifted.',
    'Festival Lore':   'Inspiration. A real app our team shipped. Reverse-engineer how it feels.',
    'Not in Jeopardy!': 'Inspiration. A team game you can play with your cohort on Friday check-ins.',
    'The Good Shelf':  'Inspiration. Values-first recommendation engine. The pattern you might build.'
  };

  pollFor('.tool-card', function () {
    var cards = qsa('.tool-card');
    cards.forEach(function (card) {
      var nameEl = card.querySelector('.tool-name');
      if (!nameEl) return;
      var name = nameEl.textContent.trim();
      var use = TOOL_USES[name];
      if (use) {
        var useEl = document.createElement('div');
        useEl.className = 'tool-use';
        useEl.textContent = use;
        card.appendChild(useEl);
      }
      var isLink = card.tagName === 'A';
      if (isLink) {
        card.addEventListener('click', function (e) {
          // prevent opening the link on first click; second click opens
          if (!card.classList.contains('is-open')) {
            e.preventDefault();
            card.classList.add('is-open');
          }
        });
      } else {
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');
        card.addEventListener('click', function () {
          card.classList.toggle('is-open');
        });
        card.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); card.classList.toggle('is-open'); }
        });
      }
    });
  });

  // ---------- 7. sponsor progress bar ----------
  // Removed: no real sponsor count yet. The new editorial pledge card handles the ask directly.

  // ---------- 8. confetti on enroll success ----------
  // Hook into the enrollment.js success toast.
  var formStatusSeen = '';
  pollFor('#enroll-status', function (status) {
    var mo = new MutationObserver(function () {
      var text = (status.textContent || '').toLowerCase();
      if (status.classList.contains('is-success') && text && text !== formStatusSeen) {
        formStatusSeen = text;
        var isWin = text.indexOf('you\'re in') > -1 || text.indexOf('you are in') > -1;
        if (isWin && window.confetti) {
          fireConfetti();
        }
        var submitBtn = qs('#enroll-form button[type="submit"]');
        if (submitBtn && isWin) {
          submitBtn.classList.add('is-celebrating');
          setTimeout(function () { submitBtn.classList.remove('is-celebrating'); }, 800);
        }
      }
    });
    mo.observe(status, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  });

  function fireConfetti() {
    if (PRM || !window.confetti) return;
    var colors = ['#d4a853', '#e8c875', '#d4729e', '#9b6fc0', '#f5f0e8'];
    var count = 120;
    var defaults = { origin: { y: 0.75 }, colors: colors, disableForReducedMotion: true };
    window.confetti(Object.assign({}, defaults, { particleCount: Math.floor(count * 0.5), spread: 70, startVelocity: 55, scalar: 1.1 }));
    setTimeout(function () {
      window.confetti(Object.assign({}, defaults, { particleCount: Math.floor(count * 0.3), angle: 60, spread: 55, origin: { x: 0, y: 0.7 } }));
      window.confetti(Object.assign({}, defaults, { particleCount: Math.floor(count * 0.3), angle: 120, spread: 55, origin: { x: 1, y: 0.7 } }));
    }, 220);
  }

  // Expose for manual testing / other triggers (e.g., sponsor success)
  window.gwvCelebrate = fireConfetti;

  // ---------- 9. hand-written notes scattered decoratively ----------
  pollFor('#summer-2026', function (sec) {
    if (sec.dataset.handNoted) return;
    sec.dataset.handNoted = '1';
    var container = sec.querySelector('.container-max');
    if (!container) return;
    container.style.position = 'relative';
    var note = document.createElement('div');
    note.className = 'hand-note';
    note.setAttribute('aria-hidden', 'true');
    note.innerHTML = '<span class="hand-note-arrow">↙</span> pick the one that fits your life';
    note.style.top = '2.2rem';
    note.style.right = '-0.5rem';
    note.style.transform = 'rotate(6deg)';
    if (window.innerWidth > 760) container.appendChild(note);
  });

  // ---------- 10. nav scroll-spy already handled by enrollment.js.
})();
