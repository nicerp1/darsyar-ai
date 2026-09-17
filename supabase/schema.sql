create table if not exists public.profiles (
  username text primary key,
  password_hash text not null,
  name text not null,
  grade text default '',
  role text not null default 'user' check (role in ('user','admin')),
  plan text not null default 'free',
  avatar text default '👩‍🎓',
  xp integer not null default 100,
  level integer not null default 1,
  streak integer not null default 1,
  registered_at timestamptz not null default now()
);

create table if not exists public.app_data (
  username text not null references public.profiles(username) on delete cascade,
  key text not null,
  value jsonb not null default 'null'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (username, key)
);

create table if not exists public.sessions (
  token text primary key,
  username text not null references public.profiles(username) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.app_data enable row level security;
alter table public.sessions enable row level security;
revoke all on public.profiles, public.app_data, public.sessions from anon, authenticated;
create index if not exists sessions_username_idx on public.sessions(username);
create index if not exists sessions_expires_at_idx on public.sessions(expires_at);
