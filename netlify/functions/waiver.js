import { supabase, sendEmail, json, cors, clientIp, escapeHtml, validEmail } from './_lib.js';

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

  const required = ['girl_name', 'guardian_name', 'guardian_email', 'guardian_signature'];
  for (const k of required) {
    if (!body[k] || String(body[k]).trim() === '') {
      return json(400, { error: `Missing field: ${k}` });
    }
  }
  if (!validEmail(body.guardian_email)) return json(400, { error: 'Invalid guardian email' });

  const consents = {
    participation: !!body.consent_participation,
    media: !!body.consent_media,
    emergency_contact: !!body.consent_emergency,
    communication: !!body.consent_communication,
  };

  if (!consents.participation) {
    return json(400, { error: 'Guardian must consent to participation' });
  }

  const db = supabase();
  const row = {
    enrollment_id: body.enrollment_id || null,
    girl_name: body.girl_name,
    guardian_name: body.guardian_name,
    guardian_email: body.guardian_email,
    guardian_signature: String(body.guardian_signature).slice(0, 200),
    guardian_relationship: body.guardian_relationship || null,
    signed_ip: clientIp(event),
    signed_ua: event.headers['user-agent'] || null,
    consents,
  };

  const { data: inserted, error } = await db.from('gwv_waivers').insert(row).select().single();
  if (error) {
    console.error('Waiver insert error', error);
    return json(500, { error: 'Could not save waiver' });
  }

  if (body.enrollment_id) {
    await db
      .from('gwv_enrollments')
      .update({ media_release: consents.media, waiver_acknowledged: true })
      .eq('id', body.enrollment_id);
  }

  try {
    await sendEmail({
      to: body.guardian_email,
      subject: 'GWV waiver received — thank you',
      html: waiverConfirmationEmail({
        girlName: body.girl_name,
        guardianName: body.guardian_name,
        signedAt: inserted.created_at,
        consents,
      }),
    });
  } catch (err) {
    console.error('Waiver email failed', err);
  }

  return json(200, { ok: true, waiver_id: inserted.id });
}

function waiverConfirmationEmail({ girlName, guardianName, signedAt, consents }) {
  const consentLines = [
    consents.participation ? '✓ Consent to participate in GWV programming' : null,
    consents.media ? '✓ Media release' : '— (no media release)',
    consents.emergency_contact ? '✓ Emergency contact authorization' : null,
    consents.communication ? '✓ Consent to communication' : null,
  ].filter(Boolean);

  return `<!DOCTYPE html>
<html><body style="font-family: 'Helvetica Neue', sans-serif; background: #1a0a2e; color: #f5f0e8; padding: 2rem;">
  <div style="max-width: 560px; margin: 0 auto; background: #2d1b4e; border-radius: 20px; padding: 2rem;">
    <h1 style="color: #e8c875; font-size: 1.5rem; margin: 0 0 1rem;">Waiver received</h1>
    <p>Thank you, ${escapeHtml(guardianName)}. We've logged your consent for <strong>${escapeHtml(girlName)}</strong> to participate in Girls Who Vibe.</p>
    <p style="color: rgba(245,240,232,0.75); font-size: 0.92rem;">Signed on ${new Date(signedAt).toLocaleString('en-US', { timeZone: 'America/Chicago' })} CT.</p>
    <ul style="list-style: none; padding: 0; color: rgba(245,240,232,0.85);">
      ${consentLines.map((l) => `<li style="margin: 0.3rem 0;">${escapeHtml(l)}</li>`).join('')}
    </ul>
    <p style="color: rgba(245,240,232,0.5); font-size: 0.85rem; margin-top: 2rem;">Keep this email for your records. Reply if anything looks off.</p>
  </div>
</body></html>`;
}
