import { sendEmail, notifySlack, json, cors, escapeHtml, validEmail } from './_lib.js';

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return cors();
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Invalid JSON' });
  }

  if (body.company) return json(200, { ok: true });

  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim();
  const message = String(body.message || '').trim();
  const topic = String(body.topic || 'general').trim();

  if (!name || !email || !message) return json(400, { error: 'Missing name, email, or message' });
  if (!validEmail(email)) return json(400, { error: 'Invalid email' });
  if (message.length > 5000) return json(400, { error: 'Message too long' });

  const admin = process.env.ADMIN_EMAIL || 'info@aidedeq.org';

  try {
    await sendEmail({
      to: admin,
      subject: `GWV contact — ${topic} — ${name}`,
      replyTo: email,
      html: `<p><strong>${escapeHtml(name)}</strong> &lt;${escapeHtml(email)}&gt;</p><p>Topic: ${escapeHtml(topic)}</p><blockquote style="border-left: 3px solid #d4a853; padding-left: 1rem;">${escapeHtml(message).replace(/\n/g, '<br>')}</blockquote>`,
    });
  } catch (err) {
    console.error('Contact admin notify failed', err);
    return json(500, { error: 'Mail send failed' });
  }

  await notifySlack(`📬 GWV contact from ${name} (${email}) — topic: ${topic}`);

  try {
    await sendEmail({
      to: email,
      subject: 'We got your message — Girls Who Vibe',
      html: `<!DOCTYPE html>
<html><body style="font-family: 'Helvetica Neue', sans-serif; background: #1a0a2e; color: #f5f0e8; padding: 2rem;">
  <div style="max-width: 520px; margin: 0 auto; background: #2d1b4e; border-radius: 20px; padding: 2rem;">
    <h1 style="color: #e8c875; font-size: 1.5rem; margin: 0 0 1rem;">Thanks, ${escapeHtml(name)} — we got it</h1>
    <p>We read every message. Expect a human reply within one to two business days.</p>
    <p>If your question is about enrolling a girl in Summer 2026, the fastest answer is on <a href="https://girlswhovibe.org/#enroll" style="color: #e8c875;">the enrollment section</a>.</p>
    <p style="color: rgba(245,240,232,0.5); font-size: 0.85rem; margin-top: 2rem;">Girls Who Vibe • A program of The Practice Center (501c3)</p>
  </div>
</body></html>`,
    });
  } catch (err) {
    console.error('Contact autoresponder failed', err);
  }

  return json(200, { ok: true });
}
