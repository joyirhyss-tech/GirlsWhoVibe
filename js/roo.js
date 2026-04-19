/* ============================================================
   ROO REPORTER — GWV edition
   Same kangaroo, same 3-type report (bug / content / idea).
   Writes to /.netlify/functions/roo so Supabase service key
   stays server-side. No auth required — public site.
   ============================================================ */

(function (global) {
  const RooReporter = {
    _cfg: null,
    _type: 'bug',
    _toastTimer: null,

    init(opts) {
      this._cfg = Object.assign({
        appName: 'girlswhovibe',
        endpoint: '/.netlify/functions/roo',
        getPageContext: () => {
          const hash = window.location.hash ? window.location.hash.slice(1) : '';
          if (hash) return hash;
          const active = document.querySelector('.nav-link.active');
          return active ? active.textContent.trim() : 'home';
        },
      }, opts || {});
      this._wire();
    },

    _wire() {
      const btn = document.getElementById('roo-btn');
      const modal = document.getElementById('roo-modal');
      const closes = document.querySelectorAll('[data-roo-close]');
      const types = document.querySelectorAll('[data-roo-type]');
      const send = document.getElementById('roo-send');
      const msg = document.getElementById('roo-message');

      if (!btn || !modal || !send || !msg) {
        console.error('[Roo] HTML snippet not found');
        return;
      }

      btn.addEventListener('click', () => this._open());
      closes.forEach((c) => c.addEventListener('click', () => this._close()));
      modal.addEventListener('click', (e) => { if (e.target === modal) this._close(); });
      types.forEach((b) => {
        b.addEventListener('click', () => {
          this._type = b.dataset.rooType;
          types.forEach((x) => x.classList.toggle('roo-active', x === b));
        });
      });
      send.addEventListener('click', () => this._send());
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('roo-open')) this._close();
      });
    },

    _open() {
      const modal = document.getElementById('roo-modal');
      modal.classList.add('roo-open');
      modal.setAttribute('aria-hidden', 'false');
      setTimeout(() => document.getElementById('roo-message')?.focus(), 100);
    },

    _close() {
      const modal = document.getElementById('roo-modal');
      modal.classList.remove('roo-open');
      modal.setAttribute('aria-hidden', 'true');
    },

    async _send() {
      const msgEl = document.getElementById('roo-message');
      const sendBtn = document.getElementById('roo-send');
      const emailEl = document.getElementById('roo-email');
      const message = msgEl.value.trim();
      if (!message) { this._toast('Tell Roo a little more about it.'); return; }

      sendBtn.disabled = true;
      const originalLabel = sendBtn.textContent;
      sendBtn.textContent = 'Hopping...';

      try {
        const res = await fetch(this._cfg.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            app_name: this._cfg.appName,
            feedback_type: this._type,
            message,
            user_email: emailEl ? emailEl.value.trim() : '',
            page_context: this._cfg.getPageContext(),
            page_url: window.location.href.slice(0, 500),
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || 'Send failed');
        }
        this._toast('Roo got it. Hopping it to the team. 🦘');
        msgEl.value = '';
        if (emailEl) emailEl.value = '';
        this._resetType();
        this._close();
      } catch (err) {
        console.error('[Roo] send failed:', err);
        this._toast('Roo got stuck. Try again in a sec.');
      } finally {
        sendBtn.disabled = false;
        sendBtn.textContent = originalLabel;
      }
    },

    _resetType() {
      this._type = 'bug';
      document.querySelectorAll('[data-roo-type]').forEach((b) => {
        b.classList.toggle('roo-active', b.dataset.rooType === 'bug');
      });
    },

    _toast(msg) {
      const t = document.getElementById('roo-toast');
      if (!t) return;
      t.textContent = msg;
      t.classList.add('roo-toast-show');
      clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(() => t.classList.remove('roo-toast-show'), 3200);
    },

    open() { this._open(); },
  };

  global.RooReporter = RooReporter;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => RooReporter.init());
  } else {
    RooReporter.init();
  }
})(typeof window !== 'undefined' ? window : this);
