-- GWV initial schema. Run against the TPC/AIdedEQ shared Supabase project (same project as AIdedEQ CRM).
-- Namespaced with gwv_ prefix so it doesn't collide with existing aidedeq tables.

create extension if not exists "pgcrypto";

-- ---------- enrollments ----------
create table if not exists gwv_enrollments (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  girl_name      text not null,
  girl_age       int,
  girl_grade     text,
  girl_pronouns  text,
  girl_email     text,
  guardian_name  text not null,
  guardian_email text not null,
  guardian_phone text,
  stream         text not null check (stream in ('afternoon_sun', 'bright_side', 'weekend_build')),
  cohort_start   date not null,
  hear_about     text,
  why_build      text,
  tuition_amount int not null default 0 check (tuition_amount between 0 and 599),
  waiver_acknowledged boolean not null default false,
  media_release  boolean not null default false,
  status         text not null default 'pending' check (status in ('pending', 'confirmed', 'waitlist', 'withdrawn')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'paid', 'sponsored', 'refunded', 'free')),
  stripe_session_id text,
  confirmation_email_sent_at timestamptz,
  source         text,
  notes          text
);

create index if not exists gwv_enrollments_stream_idx on gwv_enrollments (stream, cohort_start);
create index if not exists gwv_enrollments_status_idx on gwv_enrollments (status);
create index if not exists gwv_enrollments_created_idx on gwv_enrollments (created_at desc);

-- ---------- waivers ----------
create table if not exists gwv_waivers (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  enrollment_id   uuid references gwv_enrollments(id) on delete set null,
  girl_name       text not null,
  guardian_name   text not null,
  guardian_email  text not null,
  guardian_signature text not null,
  guardian_relationship text,
  signed_ip       text,
  signed_ua       text,
  consents        jsonb not null default '{}'::jsonb
);

create index if not exists gwv_waivers_enrollment_idx on gwv_waivers (enrollment_id);

-- ---------- sponsors ----------
create table if not exists gwv_sponsors (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  sponsor_name   text not null,
  sponsor_email  text not null,
  amount         int not null,
  seats          int not null default 1,
  message        text,
  public_credit  boolean not null default true,
  stripe_session_id text
);

-- ---------- chat ----------
create table if not exists gwv_chat_messages (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  conversation_id text not null,
  role            text not null check (role in ('user', 'assistant', 'system')),
  content         text not null,
  tokens_in       int,
  tokens_out      int,
  metadata        jsonb default '{}'::jsonb
);

create index if not exists gwv_chat_conversation_idx on gwv_chat_messages (conversation_id, created_at);

-- ---------- knowledge base (seeded for chat) ----------
create table if not exists gwv_knowledge_base (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  slug        text unique not null,
  title       text not null,
  content     text not null,
  tags        text[] default '{}'::text[]
);

insert into gwv_knowledge_base (slug, title, content, tags) values
  ('summer-2026-flagship',
   'Summer 2026 Flagship the three streams',
   'Girls Who Vibe Summer 2026 runs June 8 through July 19, 2026 (Weekend Build through July 26, skipping the July 4 weekend). It is six weeks, online, and girls pick one of three schedule streams that all run simultaneously. Afternoon Sun is Mondays and Wednesdays 1:00 to 3:00 PM Central Time (7 PM UK). Bright Side is Tuesdays and Fridays 9:30 to 11:30 AM Central Time (3:30 PM UK). Weekend Build is Saturdays and Sundays 10:00 AM to 12:00 PM Central Time (4 PM UK). Each stream holds 15 girls. Enrollment closes June 1, 2026 or when a stream fills.',
   array['cohorts','schedule','dates']),
  ('pricing',
   'Pricing and scholarships',
   'GWV runs on a sliding scale from zero dollars to five hundred ninety-nine dollars per girl. Pay what feels right for your family. Scholarship is the default, not the exception. Pick zero dollars with no questions asked. Sponsors fund seats at five hundred ninety-nine dollars each so the program stays sustainable. Camera-on is required during live sessions to protect the group experience.',
   array['cost','scholarship','pricing']),
  ('who-its-for',
   'Who GWV is for',
   'GWV is for girls in high school and opportunity-aged girls who want to learn about themselves, prepare for adulthood, and build real tools with AI. No coding experience required. If you can type a sentence and ask a question, you can build with us.',
   array['eligibility','age']),
  ('what-youll-build',
   'What girls build in six weeks',
   'By the end of the cohort, every girl will understand AI, be fluent with common platforms like Claude and Lovable and Canva and Figma, and have shipped her own real app or tool. Past builds include peer tutoring matchers, mental health check-in tools, community event finders, and personal organizer apps.',
   array['outcomes','tools','projects']),
  ('curriculum',
   'The six-week arc',
   'Week 1 is FEEL, where girls journal and pick one real problem to solve. Week 2 is FRAME, where they spec the solution. Weeks 3 and 4 are FLOW, prompting AI and building a working prototype. Week 5 is FIX, peer testing using our Roo feedback tool. Week 6 is FORWARD, Demo Day and reflection on adulthood readiness. The social-emotional throughline comes from The Practice Centers twelve Attitudinal Healing principles.',
   array['curriculum','weeks','framework']),
  ('about-gwv',
   'About Girls Who Vibe',
   'Girls Who Vibe is a program of The Practice Center, a 501(c)(3) nonprofit with EIN 41-3423272. We run alongside AIdedEQ and Women Who Vibe World Council under the same parent. Our founder has more than thirty years of youth work and facilitation experience.',
   array['about','nonprofit','parent-org']),
  ('how-to-enroll',
   'How to enroll',
   'Scroll to the Enroll section on this site. Fill out the form with your name, your guardians email, pick your stream, slide the sliding scale to what works, and acknowledge the media release. You will get a confirmation email within a minute with your Zoom link and first-session date.',
   array['enroll','signup']),
  ('for-adults',
   'For parents, mentors, and sponsors',
   'GWV is safe, structured, and trauma-informed. Every session has two trained facilitators. Guardians sign a media release as part of enrollment. Parents receive a weekly update. If you want to facilitate, mentor, or sponsor a seat, email info@aidedeq.org or use the sponsor block on the site.',
   array['parents','sponsors','safety']);

-- ---------- Roo feedback (shared across internal apps) ----------
-- Mirrors the canonical aeq_feedback table used by every internal tool.
-- Writes are server-side via the /roo Netlify Function, so RLS is locked to service role.
create table if not exists aeq_feedback (
  id             bigserial primary key,
  app_name       text not null,
  user_email     text,
  user_id        uuid,
  feedback_type  text not null check (feedback_type in ('bug','content','idea')),
  message        text not null,
  page_context   text,
  page_url       text,
  user_agent     text,
  status         text default 'new' check (status in ('new','triaged','in_progress','fixed','wont_fix','duplicate')),
  severity       text check (severity in ('low','med','high','critical')),
  assigned_to    text,
  resolution     text,
  linked_commit  text,
  fingerprint    text,
  occurrence_count int default 1,
  first_seen_at  timestamptz default now(),
  last_seen_at   timestamptz default now(),
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);
create index if not exists aeq_feedback_app_idx on aeq_feedback(app_name);
create index if not exists aeq_feedback_status_idx on aeq_feedback(status);
create index if not exists aeq_feedback_created_idx on aeq_feedback(created_at desc);
alter table aeq_feedback enable row level security;

-- ---------- row level security (locked by default; service role only) ----------
alter table gwv_enrollments enable row level security;
alter table gwv_waivers enable row level security;
alter table gwv_sponsors enable row level security;
alter table gwv_chat_messages enable row level security;
alter table gwv_knowledge_base enable row level security;

create policy gwv_enrollments_service on gwv_enrollments for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy gwv_waivers_service on gwv_waivers for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy gwv_sponsors_service on gwv_sponsors for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy gwv_chat_messages_service on gwv_chat_messages for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy gwv_knowledge_base_service on gwv_knowledge_base for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- Anonymous readers can query knowledge base (it is intentionally public content):
create policy gwv_knowledge_base_public_read on gwv_knowledge_base for select using (true);

drop policy if exists aeq_feedback_service on aeq_feedback;
create policy aeq_feedback_service on aeq_feedback for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
