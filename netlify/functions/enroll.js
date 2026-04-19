import {
  SUMMER_2026,
  supabase,
  sendEmail,
  notifySlack,
  json,
  cors,
  escapeHtml,
  validEmail,
} from './_lib.js';

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

  const required = ['girl_name', 'guardian_name', 'guardian_email', 'stream', 'waiver_acknowledged'];
  for (const k of required) {
    if (body[k] === undefined || body[k] === null || body[k] === '') {
      return json(400, { error: `Missing field: ${k}` });
    }
  }
  if (!validEmail(body.guardian_email)) return json(400, { error: 'Invalid guardian email' });
  if (body.girl_email && !validEmail(body.girl_email)) return json(400, { error: 'Invalid girl email' });
  if (!SUMMER_2026.streams[body.stream]) return json(400, { error: 'Unknown stream' });
  if (!body.waiver_acknowledged) return json(400, { error: 'Waiver must be acknowledged' });

  const tuition = Math.max(0, Math.min(599, parseInt(body.tuition_amount || 0, 10)));
  const db = supabase();

  const { count: filledCount, error: countErr } = await db
    .from('gwv_enrollments')
    .select('id', { count: 'exact', head: true })
    .eq('stream', body.stream)
    .eq('cohort_start', SUMMER_2026.start)
    .in('status', ['pending', 'confirmed']);

  if (countErr) {
    console.error('Count error', countErr);
    return json(500, { error: 'Database error' });
  }

  const status = filledCount >= SUMMER_2026.capacityPerStream ? 'waitlist' : 'pending';
  const payment_status = tuition === 0 ? 'free' : 'unpaid';

  const row = {
    girl_name: body.girl_name,
    girl_age: body.girl_age ? parseInt(body.girl_age, 10) : null,
    girl_grade: body.girl_grade || null,
    girl_pronouns: body.girl_pronouns || null,
    girl_email: body.girl_email || null,
    guardian_name: body.guardian_name,
    guardian_email: body.guardian_email,
    guardian_phone: body.guardian_phone || null,
    stream: body.stream,
    cohort_start: SUMMER_2026.start,
    hear_about: body.hear_about || null,
    why_build: body.why_build || null,
    tuition_amount: tuition,
    waiver_acknowledged: !!body.waiver_acknowledged,
    media_release: !!body.media_release,
    status,
    payment_status,
    source: body.source || 'girlswhovibe.org',
  };

  const { data: inserted, error: insertErr } = await db
    .from('gwv_enrollments')
    .insert(row)
    .select()
    .single();

  if (insertErr) {
    console.error('Insert error', insertErr);
    return json(500, { error: 'Could not save enrollment' });
  }

  const stream = SUMMER_2026.streams[body.stream];
  const isWaitlist = status === 'waitlist';
  const isFree = tuition === 0;

  const subject = isWaitlist
    ? `You're on the waitlist for ${stream.label} — Girls Who Vibe`
    : `You're in. ${stream.label} starts ${stream.firstSession} — Girls Who Vibe`;

  const html = isWaitlist
    ? waitlistEmail({ girlName: body.girl_name, stream })
    : welcomeEmail({ girlName: body.girl_name, stream, tuition, isFree });

  try {
    const recipients = [body.guardian_email];
    if (body.girl_email) recipients.push(body.girl_email);
    await sendEmail({
      to: recipients,
      subject,
      html,
      text: stripTags(html),
    });
    await db
      .from('gwv_enrollments')
      .update({ confirmation_email_sent_at: new Date().toISOString() })
      .eq('id', inserted.id);
  } catch (err) {
    console.error('Email send failed', err);
  }

  const adminSummary = `🌸 New GWV enrollment: ${escapeHtml(body.girl_name)} (age ${row.girl_age || 'n/a'}) → *${stream.label}* — tuition $${tuition} — status ${status}. Guardian: ${escapeHtml(body.guardian_name)} <${escapeHtml(body.guardian_email)}>`;
  await notifySlack(adminSummary);
  try {
    await sendEmail({
      to: process.env.ADMIN_EMAIL || 'info@aidedeq.org',
      subject: `GWV enrollment — ${body.girl_name} → ${stream.label}`,
      html: `<p>${adminSummary}</p><p>Why they want to build: ${escapeHtml(body.why_build || '—')}</p>`,
    });
  } catch (err) {
    console.error('Admin notify failed', err);
  }

  const response = {
    ok: true,
    enrollment_id: inserted.id,
    status,
    stream: body.stream,
    tuition_amount: tuition,
    requires_payment: !isFree && !isWaitlist,
  };

  return json(200, response);
}

function welcomeEmail({ girlName, stream, tuition, isFree }) {
  const paymentLine = isFree
    ? '<p style="margin: 1rem 0;">Your seat is <strong>fully covered</strong> by our community sponsors. Show up ready to build.</p>'
    : `<p style="margin: 1rem 0;">You chose <strong>$${tuition}</strong> on the sliding scale. Thank you — your contribution helps us offer free seats to other girls.</p>`;

  return `<!DOCTYPE html>
<html><body style="font-family: 'Helvetica Neue', sans-serif; background: #1a0a2e; color: #f5f0e8; padding: 2rem;">
  <div style="max-width: 560px; margin: 0 auto; background: linear-gradient(135deg, #2d1b4e, #1a0a2e); border-radius: 20px; padding: 2rem; border: 1px solid rgba(212,168,83,0.3);">
    <h1 style="color: #e8c875; font-size: 1.8rem; margin: 0 0 1rem;">You're in, ${escapeHtml(girlName)} ✨</h1>
    <p style="font-size: 1.05rem; line-height: 1.6;">Welcome to Girls Who Vibe, <strong>${stream.label}</strong> stream.</p>
    <div style="background: rgba(212,168,83,0.1); border-left: 3px solid #d4a853; padding: 1rem 1.25rem; border-radius: 8px; margin: 1.5rem 0;">
      <p style="margin: 0 0 0.5rem;"><strong>Your schedule</strong></p>
      <p style="margin: 0;">${stream.days}, ${stream.time}</p>
      <p style="margin: 0.5rem 0 0;"><strong>First session:</strong> ${stream.firstSession}</p>
    </div>
    ${paymentLine}
    <p style="line-height: 1.6;">In the next 48 hours you'll get a second email with your Zoom link, a short welcome packet, and a "what to bring" checklist.</p>
    <p style="line-height: 1.6;">Questions? Reply to this email — it goes straight to our team.</p>
    <p style="color: rgba(245,240,232,0.5); font-size: 0.85rem; margin-top: 2rem; border-top: 1px solid rgba(245,240,232,0.1); padding-top: 1rem;">
      Girls Who Vibe is a program of The Practice Center, a 501(c)(3) nonprofit (EIN 41-3423272).
    </p>
  </div>
</body></html>`;
}

function waitlistEmail({ girlName, stream }) {
  return `<!DOCTYPE html>
<html><body style="font-family: 'Helvetica Neue', sans-serif; background: #1a0a2e; color: #f5f0e8; padding: 2rem;">
  <div style="max-width: 560px; margin: 0 auto; background: linear-gradient(135deg, #2d1b4e, #1a0a2e); border-radius: 20px; padding: 2rem; border: 1px solid rgba(155,111,192,0.3);">
    <h1 style="color: #e8c875; font-size: 1.8rem; margin: 0 0 1rem;">You're on the waitlist, ${escapeHtml(girlName)} 🌸</h1>
    <p style="font-size: 1.05rem; line-height: 1.6;">The <strong>${stream.label}</strong> stream filled up just before your form came in. We've saved your spot on the waitlist — if someone drops, you're next.</p>
    <p style="line-height: 1.6;">In the meantime, reply to this email and tell us which of the other streams could also work for you. We'd love to get you in Summer 2026.</p>
    <p style="color: rgba(245,240,232,0.5); font-size: 0.85rem; margin-top: 2rem; border-top: 1px solid rgba(245,240,232,0.1); padding-top: 1rem;">
      Girls Who Vibe is a program of The Practice Center, a 501(c)(3) nonprofit (EIN 41-3423272).
    </p>
  </div>
</body></html>`;
}

function stripTags(html) {
  return html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}
