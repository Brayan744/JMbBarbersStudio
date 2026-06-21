create table if not exists client_users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text unique not null,
  password_hash text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references client_users(id) on delete set null,
  name text not null,
  phone text not null,
  date date not null,
  time text not null,
  service text not null default 'Corte',
  price integer not null default 16000,
  created_at timestamptz not null default now(),
  unique (date, time)
);

create index if not exists appointments_date_idx on appointments(date);
create index if not exists client_users_status_idx on client_users(status);

-- Demo simple desde HTML/JS: permite que la publishable key use estas tablas.
-- Para produccion real, lo ideal es migrar a Supabase Auth y politicas por usuario.
alter table client_users enable row level security;
alter table appointments enable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on client_users to anon, authenticated;
grant select, insert, update, delete on appointments to anon, authenticated;

drop policy if exists "public client users access" on client_users;
drop policy if exists "public appointments access" on appointments;

create policy "public client users access"
on client_users
for all
to anon, authenticated
using (true)
with check (true);

create policy "public appointments access"
on appointments
for all
to anon, authenticated
using (true)
with check (true);

create table if not exists blocked_slots (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  time text not null,
  note text default 'Bloqueado por barbero',
  created_at timestamptz not null default now(),
  unique (date, time)
);

create table if not exists day_schedules (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  hours text[] not null,
  closed boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists vip_schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references client_users(id) on delete cascade,
  name text not null,
  phone text not null,
  day_of_week int not null check (day_of_week between 0 and 6),
  time text not null,
  frequency text not null default 'weekly' check (frequency in ('weekly', 'biweekly')),
  start_date date not null default current_date,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists vip_exceptions (
  id uuid primary key default gen_random_uuid(),
  vip_schedule_id uuid references vip_schedules(id) on delete cascade,
  original_date date not null,
  action text not null check (action in ('skip', 'reschedule')),
  new_date date,
  new_time text,
  created_at timestamptz not null default now(),
  unique (vip_schedule_id, original_date)
);

create table if not exists notification_log (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  message text not null,
  type text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  related_date date,
  related_time text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

alter table blocked_slots enable row level security;
alter table day_schedules enable row level security;
alter table vip_schedules enable row level security;
alter table vip_exceptions enable row level security;
alter table notification_log enable row level security;

grant select, insert, update, delete on blocked_slots to anon, authenticated;
grant select, insert, update, delete on day_schedules to anon, authenticated;
grant select, insert, update, delete on vip_schedules to anon, authenticated;
grant select, insert, update, delete on vip_exceptions to anon, authenticated;
grant select, insert, update, delete on notification_log to anon, authenticated;

create policy "public blocked slots access" on blocked_slots for all to anon, authenticated using (true) with check (true);
create policy "public day schedules access" on day_schedules for all to anon, authenticated using (true) with check (true);
create policy "public vip schedules access" on vip_schedules for all to anon, authenticated using (true) with check (true);
create policy "public vip exceptions access" on vip_exceptions for all to anon, authenticated using (true) with check (true);
create policy "public notification log access" on notification_log for all to anon, authenticated using (true) with check (true);

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references client_users(id) on delete cascade,
  phone text not null,
  role text not null default 'client' check (role in ('client', 'barber')),
  player_id text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_subscriptions_phone_idx on push_subscriptions(phone);

alter table push_subscriptions enable row level security;
grant select, insert, update, delete on push_subscriptions to anon, authenticated;
create policy "public push subscriptions access" on push_subscriptions for all to anon, authenticated using (true) with check (true);
