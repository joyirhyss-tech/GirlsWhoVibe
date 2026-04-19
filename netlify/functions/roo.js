import { supabase, notifySlack, json, cors, clientIp, validEmail } from './_lib.js';

const VALID_TYPES = ['bug', 'content', 'idea'];

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return cors();
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Invalid JSON' });
  }

  const message = String(body.message || '').trim();
  const type = String(body.feedback_type || 'bug').trim();
  const appName = String(body.app_name || 'girlswhovibe').trim();

  if (!message) return json(400, { error: 'Message is required' });
  if (message.length > 4000) return json(400, { error: 'Message too long' });
  if (!VALID_TYPES.includes(type)) return json(400, { error: 'Invalid feedback type' });

  const email = String(body.user_email || '').trim();
  if (email && !validEmail(email)) return json(400, { error: 'Invalid email' });

  const row = {
    app_name: appName,
    user_email: email || 'anonymous',
    feedback_type: type,
    message,
    page_context: String(body.page_context || '').slice(0, 200) || null,
    page_url: String(body.page_url || '').slice(0, 500) || null,
    user_agent: (event.headers['user-agent'] || '').slice(0, 500),
  };

  try {
    const db = supabase();
    const { error } = await db.from('aeq_feedback').insert(row);
    if (error) {
      console.error('Roo insert error', error);
      return json(500, { error: 'Could not save feedback' });
    }
  } catch (err) {
    console.error('Roo supabase error', err);
    return json(500, { error: 'Storage error' });
  }

  const emoji = type === 'bug' ? '🐞' : type === 'idea' ? '💡' : '✏️';
  const snippet = message.length > 160 ? message.slice(0, 157) + '...' : message;
  await notifySlack(`${emoji} Roo (${appName}): ${snippet}${email ? ' — from ' + email : ''} — page: ${row.page_context || row.page_url || 'n/a'}`);

  return json(200, { ok: true });
}
