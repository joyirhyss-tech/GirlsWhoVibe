// GWV enrollment form: stream picker, sliding-scale slider, POST to /.netlify/functions/enroll,
// then optionally redirects to Stripe Checkout.
(function () {
  'use strict';

  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function initStreamPicker() {
    var cards = qsa('[data-stream-card]');
    var hidden = qs('[name="stream"]');
    if (!cards.length || !hidden) return;

    cards.forEach(function (card) {
      card.addEventListener('click', function () {
        if (card.classList.contains('is-waitlist')) return;
        cards.forEach(function (c) { c.classList.remove('is-selected'); c.setAttribute('aria-checked', 'false'); });
        card.classList.add('is-selected');
        card.setAttribute('aria-checked', 'true');
        hidden.value = card.getAttribute('data-stream-card');
        hidden.dispatchEvent(new Event('change', { bubbles: true }));
      });
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); card.click(); }
      });
    });
  }

  function initSlider() {
    var slider = qs('input[name="tuition_amount"]');
    var amountEl = qs('[data-slider-amount]');
    var labelEl = qs('[data-slider-label]');
    var presets = qsa('[data-slider-preset]');
    if (!slider || !amountEl) return;

    function labelFor(v) {
      var n = parseInt(v, 10);
      if (n === 0) return 'Scholarship, fully sponsored';
      if (n <= 99) return 'Community rate';
      if (n <= 299) return 'Supporter rate';
      if (n <= 499) return 'Sustainer rate';
      if (n < 599) return 'Near-full tuition';
      return 'Full tuition (and funds another girl)';
    }

    function update(v) {
      slider.value = v;
      amountEl.textContent = '$' + v;
      if (labelEl) labelEl.textContent = labelFor(v);
      presets.forEach(function (p) {
        p.classList.toggle('is-active', parseInt(p.getAttribute('data-slider-preset'), 10) === parseInt(v, 10));
      });
    }

    slider.addEventListener('input', function () { update(slider.value); });
    presets.forEach(function (p) {
      p.addEventListener('click', function () { update(p.getAttribute('data-slider-preset')); });
    });
    update(slider.value);
  }

  function initForm() {
    var form = qs('#enroll-form');
    if (!form) return;
    var status = qs('#enroll-status');
    var submit = form.querySelector('button[type="submit"]');

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.stream.value) {
        showStatus('error', 'Pick a stream above before submitting.');
        return;
      }
      if (!form.waiver_acknowledged.checked) {
        showStatus('error', 'Please acknowledge the media release and waiver before enrolling.');
        return;
      }

      var payload = {
        girl_name: form.girl_name.value.trim(),
        girl_age: form.girl_age.value.trim(),
        girl_grade: form.girl_grade.value.trim(),
        girl_pronouns: form.girl_pronouns.value.trim(),
        girl_email: form.girl_email.value.trim(),
        guardian_name: form.guardian_name.value.trim(),
        guardian_email: form.guardian_email.value.trim(),
        guardian_phone: form.guardian_phone.value.trim(),
        stream: form.stream.value,
        tuition_amount: parseInt(form.tuition_amount.value, 10) || 0,
        why_build: form.why_build.value.trim(),
        hear_about: form.hear_about.value.trim(),
        waiver_acknowledged: form.waiver_acknowledged.checked,
        media_release: form.media_release.checked,
        company: form.company ? form.company.value : '',
      };

      submit.disabled = true;
      submit.textContent = 'Saving...';
      showStatus('pending', 'Saving your enrollment...');

      fetch('/.netlify/functions/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, body: j }; }); })
        .then(function (res) {
          if (!res.ok) {
            submit.disabled = false;
            submit.textContent = 'Enroll me';
            showStatus('error', res.body.error || 'Something went wrong. Try again.');
            return;
          }
          if (res.body.requires_payment) {
            submit.textContent = 'Taking you to checkout...';
            return fetch('/.netlify/functions/create-tuition-checkout', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                amount: res.body.tuition_amount,
                email: payload.guardian_email,
                girl_name: payload.girl_name,
                enrollment_id: res.body.enrollment_id,
                mode: 'tuition',
              }),
            })
              .then(function (r) { return r.json(); })
              .then(function (cs) {
                if (cs.url) { window.location.href = cs.url; }
                else {
                  showStatus('success', 'You are enrolled. We will email you a payment link.');
                  form.reset();
                  submit.disabled = false;
                  submit.textContent = 'Enroll me';
                }
              });
          }
          if (res.body.status === 'waitlist') {
            showStatus('success', 'That stream is full — you are on the waitlist. Check your email for next steps.');
          } else {
            showStatus('success', "You're in. Check your email for your first-session details.");
          }
          form.reset();
          submit.disabled = false;
          submit.textContent = 'Enroll me';
          var cards = qsa('[data-stream-card]');
          cards.forEach(function (c) { c.classList.remove('is-selected'); });
        })
        .catch(function (err) {
          console.error(err);
          submit.disabled = false;
          submit.textContent = 'Enroll me';
          showStatus('error', 'Network glitch. Try again in a moment.');
        });
    });

    function showStatus(kind, text) {
      if (!status) return;
      status.textContent = text;
      status.className = 'form-status ' + (kind === 'error' ? 'is-error' : 'is-success');
    }
  }

  function initContactForm() {
    var form = qs('#contact-form');
    if (!form) return;
    var status = qs('#contact-status');
    var submit = form.querySelector('button[type="submit"]');

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var payload = {
        name: form.name.value.trim(),
        email: form.email.value.trim(),
        topic: form.topic.value,
        message: form.message.value.trim(),
        company: form.company ? form.company.value : '',
      };
      submit.disabled = true;
      submit.textContent = 'Sending...';

      fetch('/.netlify/functions/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, body: j }; }); })
        .then(function (res) {
          submit.disabled = false;
          submit.textContent = 'Send';
          if (!res.ok) {
            status.textContent = res.body.error || 'Could not send. Try again.';
            status.className = 'form-status is-error';
            return;
          }
          status.textContent = 'Thanks. We will reply within one to two business days.';
          status.className = 'form-status is-success';
          form.reset();
        })
        .catch(function () {
          submit.disabled = false;
          submit.textContent = 'Send';
          status.textContent = 'Network glitch. Try again.';
          status.className = 'form-status is-error';
        });
    });
  }

  function initNavScroll() {
    var nav = document.querySelector('.nav-fixed');
    if (!nav) return;
    function update() {
      if (window.scrollY > 80) nav.classList.add('is-scrolled');
      else nav.classList.remove('is-scrolled');
    }
    update();
    window.addEventListener('scroll', update, { passive: true });
  }

  var initialized = false;
  function tryInit() {
    if (initialized) return true;
    var form = document.getElementById('enroll-form');
    var slider = document.querySelector('input[name="tuition_amount"]');
    if (!form || !slider) return false;
    initStreamPicker();
    initSlider();
    initForm();
    initContactForm();
    initNavScroll();
    initialized = true;
    return true;
  }

  function waitForReact() {
    if (tryInit()) return;
    var tries = 0;
    var timer = setInterval(function () {
      tries += 1;
      if (tryInit() || tries > 60) {
        clearInterval(timer);
        if (!initialized) initNavScroll();
      }
    }, 100);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitForReact);
  } else {
    waitForReact();
  }
})();
