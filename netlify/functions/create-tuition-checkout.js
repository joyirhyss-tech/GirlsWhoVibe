import Stripe from 'stripe';
import { supabase, json, cors, validEmail } from './_lib.js';

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return cors();
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return json(500, { error: 'Payments not configured' });

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Invalid JSON' });
  }

  // Sponsor gifts can be larger than a single seat; tuition capped at $599 single seat price.
  const rawAmount = parseInt(body.amount || 0, 10);
  const cap = body.mode === 'sponsor' ? 25000 : 599;
  const amount = Math.max(1, Math.min(cap, rawAmount));
  const email = String(body.email || '').trim();
  const enrollmentId = String(body.enrollment_id || '').trim();
  const girlName = String(body.girl_name || '').trim();
  const mode = body.mode === 'sponsor' ? 'sponsor' : 'tuition';

  if (!validEmail(email)) return json(400, { error: 'Invalid email' });
  if (mode === 'tuition' && !enrollmentId) return json(400, { error: 'Missing enrollment_id' });

  const stripe = new Stripe(key);

  const origin = event.headers.origin || 'https://girlswhovibe.org';
  const productName =
    mode === 'sponsor'
      ? `Sponsor a seat — Girls Who Vibe Summer 2026`
      : `GWV Summer 2026 tuition${girlName ? ' for ' + girlName : ''}`;

  let session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: { name: productName },
            unit_amount: amount * 100,
          },
          quantity: 1,
        },
      ],
      metadata: {
        mode,
        enrollment_id: enrollmentId || '',
        girl_name: girlName,
      },
      success_url: `${origin}/#enroll-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/#enroll`,
    });
  } catch (err) {
    console.error('Stripe create error', err);
    return json(502, { error: 'Could not create checkout session' });
  }

  if (mode === 'tuition' && enrollmentId) {
    try {
      const db = supabase();
      await db
        .from('gwv_enrollments')
        .update({ stripe_session_id: session.id })
        .eq('id', enrollmentId);
    } catch (err) {
      console.warn('Could not attach session id', err.message);
    }
  }

  return json(200, { url: session.url, session_id: session.id });
}
