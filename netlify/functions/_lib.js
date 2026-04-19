import { createClient } from '@supabase/supabase-js';

export const SUMMER_2026 = {
  start: '2026-06-08',
  end: '2026-07-26',
  enrollmentCloses: '2026-06-01',
  capacityPerStream: 15,
  streams: {
    afternoon_sun: {
      label: 'Afternoon Sun',
      days: 'Mon & Wed',
      time: '1:00\u20133:00 PM CT',
      firstSession: '2026-06-08',
      lastSession: '2026-07-15',
    },
    bright_side: {
      label: 'Bright Side',
      days: 'Tue & Fri',
      time: '9:30\u201311:30 AM CT',
      firstSession: '2026-06-09',
      lastSession: '2026-07-17',
    },
    weekend_build: {
      label: 'Weekend Build',
      days: 'Sat & Sun',
      time: '10:00 AM\u201312:00 PM CT',
      firstSession: '2026-06-13',
      lastSession: '2026-07-26',
    },
  },
};

export function supabase() {
  const url = process.env.CRM_SUPABASE_URL;
  const key = process.env.CRM_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase env vars missing');
  return createClient(url, key, { auth: { persistSession: false } });
}

export function json(status, body, extraHeaders = {}) {
  return {
    statusCode: status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  };
}

export function cors() {
  return {
    statusCode: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
    body: '',
  };
}

export function clientIp(event) {
  return (
    event.headers['x-nf-client-connection-ip'] ||
    event.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    event.headers['client-ip'] ||
    null
  );
}

export async function sendEmail({ to, subject, html, text, replyTo }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn('RESEND_API_KEY missing — skipping email to', to);
    return { skipped: true };
  }
  const from = process.env.EMAIL_FROM || 'GWV <hello@girlswhovibe.org>';
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      text,
      reply_to: replyTo || 'info@aidedeq.org',
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error('Resend error', res.status, body);
    throw new Error(`Resend failed: ${res.status}`);
  }
  return res.json();
}

export async function notifySlack(text) {
  const hook = process.env.SLACK_WEBHOOK_URL;
  if (!hook) return { skipped: true };
  try {
    await fetch(hook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
  } catch (err) {
    console.error('Slack notify failed', err);
  }
}

export function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function validEmail(s) {
  return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}
