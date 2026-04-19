import { SUMMER_2026, supabase, sendEmail, notifySlack } from './_lib.js';

export async function handler() {
  const db = supabase();

  const { data: rows, error } = await db
    .from('gwv_enrollments')
    .select('stream, status, payment_status, tuition_amount, created_at, girl_name')
    .eq('cohort_start', SUMMER_2026.start)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Digest query failed', error);
    return { statusCode: 500, body: 'query failed' };
  }

  const all = rows || [];
  const byStream = {};
  for (const key of Object.keys(SUMMER_2026.streams)) byStream[key] = [];
  for (const r of all) {
    if (byStream[r.stream]) byStream[r.stream].push(r);
  }

  const sevenDaysAgo = Date.now() - 7 * 86400000;
  const recent = all.filter((r) => new Date(r.created_at).getTime() > sevenDaysAgo);

  const totalTuition = all
    .filter((r) => r.payment_status === 'paid')
    .reduce((sum, r) => sum + (r.tuition_amount || 0), 0);

  const streamRows = Object.entries(SUMMER_2026.streams)
    .map(([key, meta]) => {
      const arr = byStream[key] || [];
      const enrolled = arr.filter((r) => ['pending', 'confirmed'].includes(r.status)).length;
      const waitlist = arr.filter((r) => r.status === 'waitlist').length;
      return `<tr><td><strong>${meta.label}</strong> <span style="color:#888">(${meta.days} ${meta.time})</span></td><td>${enrolled}/${SUMMER_2026.capacityPerStream}</td><td>${waitlist}</td></tr>`;
    })
    .join('');

  const html = `<!DOCTYPE html>
<html><body style="font-family: 'Helvetica Neue', sans-serif; background: #faf7f2; padding: 2rem;">
  <div style="max-width: 640px; margin: 0 auto; background: #fff; border-radius: 16px; padding: 2rem;">
    <h1 style="color: #1a0a2e; margin: 0 0 1rem;">GWV Summer 2026 — weekly digest</h1>
    <p style="color: #555;">Cohort window: ${SUMMER_2026.start} → ${SUMMER_2026.end}. Enrollment closes ${SUMMER_2026.enrollmentCloses}.</p>
    <h2 style="margin-top: 1.5rem; font-size: 1.1rem;">Stream status</h2>
    <table style="width:100%; border-collapse: collapse;" cellpadding="8">
      <thead><tr style="background:#f0ecf5; text-align:left;"><th>Stream</th><th>Enrolled</th><th>Waitlist</th></tr></thead>
      <tbody>${streamRows}</tbody>
    </table>
    <h2 style="margin-top: 1.5rem; font-size: 1.1rem;">This week</h2>
    <p>New enrollments in the last 7 days: <strong>${recent.length}</strong></p>
    <p>Tuition collected to date: <strong>$${totalTuition}</strong></p>
    <p style="color:#888; font-size:0.85rem; margin-top:2rem; border-top:1px solid #eee; padding-top:1rem;">Sent automatically every Monday 7am CT.</p>
  </div>
</body></html>`;

  try {
    await sendEmail({
      to: process.env.ADMIN_EMAIL || 'info@aidedeq.org',
      subject: `GWV weekly — ${all.length} enrolled, ${recent.length} new this week`,
      html,
    });
  } catch (err) {
    console.error('Digest email failed', err);
  }

  await notifySlack(`📊 GWV Summer weekly digest sent. Total enrolled: ${all.length}. New this week: ${recent.length}.`);

  return { statusCode: 200, body: 'ok' };
}
