-- Email templates configurable from admin panel
create table if not exists email_templates (
  type       text primary key,
  subject    text not null,
  body       text not null,
  updated_at timestamptz not null default now()
);

alter table email_templates enable row level security;

-- Only service role can read/write (admin API uses service role client)
create policy "admin_all" on email_templates
  using (false) with check (false);

-- Default enrollment confirmation template
insert into email_templates (type, subject, body) values (
  'enrollment',
  'You''re enrolled in {{course_en}} — Krishnamargam',
  'Namaskar {{name}},

You are now enrolled in {{course_en}} ({{course_te}}).

Your spiritual journey begins now. May this path bring you clarity, wisdom, and peace.

Click below to start learning: {{link}}'
) on conflict (type) do nothing;
