# GWV Summer 2026 — Deploy Checklist

Everything that has to happen on external services before the site is fully live.

## 1. Push to GitHub
Repo: `gabriellaflowers6-pixel/GirlsWhoVibe`. Netlify auto-deploys on push to `main`.

```bash
cd "/Users/jkr/Documents/ALL Build Projects/Site GirlsWhoVibe_dashboard/GirlsWhoVibe-Site Info"
git add .gitignore DEPLOY.md .
git status
git commit -m "feat: Summer 2026 launch — content, automation, agentic SEO, Bloom Break"
git push origin main
```

## 2. Netlify — environment variables
Site ID: `221d85b5-c4e8-4b92-9dd5-b401657b3063` (project name: `girls-who-vibe`).
Netlify UI → Site settings → Environment variables → add:

| Variable | Source | Scope |
|---|---|---|
| `ADMIN_EMAIL` | `info@aidedeq.org` | All |
| `EMAIL_FROM` | `GWV <hello@girlswhovibe.org>` (or whichever is verified in Resend) | All |
| `RESEND_API_KEY` | Resend dashboard → API keys | Functions |
| `CRM_SUPABASE_URL` | Supabase project URL (same TPC/AIdedEQ project) | Functions |
| `CRM_SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → `service_role` key | Functions |
| `STRIPE_SECRET_KEY` | Stripe dashboard → Developers → API keys (live) | Functions |
| `STRIPE_WEBHOOK_SECRET` | Stripe → webhooks (only if we re-enable webhook flow) | Functions |
| `ANTHROPIC_API_KEY` | (only needed if we re-enable the chat function; not currently used) | Functions |
| `SLACK_WEBHOOK_URL` | Slack → Apps → Incoming webhooks (optional) | Functions |

## 3. Supabase
- Run `supabase/migrations/0001_gwv_init.sql` against the TPC/AIdedEQ project.
  - Creates: `gwv_enrollments`, `gwv_waivers`, `gwv_sponsors`, `gwv_chat_messages`, `gwv_knowledge_base`, plus `aeq_feedback` (Roo) if it doesn't already exist.
  - Seeds the knowledge base with current dates, pricing, FAQ.

## 4. Stripe
- The sponsor flow uses the choose-your-own-amount Stripe donation link: `https://donate.stripe.com/eVq7sE7GoaRw8wN5WJ4800b`.
- Verify the link accepts domain `girlswhovibe.org` for Apple Pay.
- (If you want dynamic tuition checkout later: the `/create-tuition-checkout` function is already written, just needs `STRIPE_SECRET_KEY`.)

## 5. DNS / domain
- Primary domain: `girlswhovibe.org` pointed at the Netlify site.
- TLS via Netlify/Let's Encrypt (automatic).
- Add `www.girlswhovibe.org` redirect to apex.

## 6. Google Calendar
All done. Events live on the organizer's calendar:
- Afternoon Sun cohort (recurring Mon/Wed 1–3 PM CT, 12 sessions Jun 8 – Jul 15)
- Bright Side cohort (recurring Tue/Fri 9:30–11:30 AM CT, 12 sessions Jun 9 – Jul 17)
- Weekend Build cohort (recurring Sat/Sun 10 AM – 12 PM CT, 12 sessions Jun 13 – Jul 26, skips Jul 4/5)
- 6 Info Days (May 11, 13, 15, 18, 20, 22)
- Demo Day (Sat Jul 25, 2–4 PM CT)

## 7. AEO / GEO
- `llms.txt` at `/llms.txt` — structured Markdown program summary for LLMs.
- `robots.txt` explicitly allows GPTBot, ClaudeBot, PerplexityBot, Google-Extended, Applebot-Extended.
- `sitemap.xml` covers the hero anchors.
- Verify Bing Webmaster Tools + Google Search Console have the site.

## 8. Post-deploy smoke test
1. Visit `girlswhovibe.org`. Hero loads, verb cycles, blossom idle.
2. Tap to bloom → modal opens → dots animate smoothly.
3. Open Roo (pink kangaroo) → modal opens → switch type → close.
4. Scroll to Sponsor → tap $599 tile → tap "Continue to secure checkout →" → lands on Stripe donate page.
5. Scroll to Enroll → submit a test enrollment → verify Supabase row + email.
6. Check `llms.txt` is reachable, `robots.txt` loads, `sitemap.xml` loads.

## 9. Announce
Trigger the distribution list in `DISTRIBUTION.md`. The 6-week launch sequence starts this week.
