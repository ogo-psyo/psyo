-- Better Auth core schema + better-auth-telegram Mini App fields.
-- Generated manually from Better Auth core models and better-auth-telegram v1.5.0 plugin schema
-- because the Better Auth CLI requires a live Postgres connection to introspect before generating SQL.

create table if not exists public."user" (
  id text primary key,
  name text not null,
  email text not null unique,
  "emailVerified" boolean not null default false,
  image text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  "telegramId" text,
  "telegramUsername" text,
  "telegramPhoneNumber" text
);

create table if not exists public."session" (
  id text primary key,
  "expiresAt" timestamptz not null,
  token text not null unique,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  "ipAddress" text,
  "userAgent" text,
  "userId" text not null references public."user"(id) on delete cascade
);

create table if not exists public."account" (
  id text primary key,
  "accountId" text not null,
  "providerId" text not null,
  "userId" text not null references public."user"(id) on delete cascade,
  "accessToken" text,
  "refreshToken" text,
  "idToken" text,
  "accessTokenExpiresAt" timestamptz,
  "refreshTokenExpiresAt" timestamptz,
  scope text,
  password text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  "telegramId" text,
  "telegramUsername" text
);

create table if not exists public."verification" (
  id text primary key,
  identifier text not null,
  value text not null,
  "expiresAt" timestamptz not null,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create index if not exists better_auth_session_user_idx on public."session"("userId");
create index if not exists better_auth_account_user_idx on public."account"("userId");
create index if not exists better_auth_account_provider_account_idx on public."account"("providerId", "accountId");
create index if not exists better_auth_user_telegram_idx on public."user"("telegramId");
create index if not exists better_auth_account_telegram_idx on public."account"("telegramId");

alter table public."user" enable row level security;
alter table public."session" enable row level security;
alter table public."account" enable row level security;
alter table public."verification" enable row level security;
