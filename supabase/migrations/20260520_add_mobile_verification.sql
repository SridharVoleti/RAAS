-- Migration: Mobile verification support
-- Run in Supabase SQL Editor after add_profile_fields migration

-- 1. Add mobile_verified column to profiles
alter table profiles
  add column if not exists mobile_verified boolean not null default false;

-- 2. OTP tokens table (no auth required to read/write via service role)
create table if not exists otp_tokens (
  id         bigserial primary key,
  mobile     text not null,
  token      text not null,
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  used       boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_otp_tokens_mobile
  on otp_tokens(mobile, used, expires_at);

-- Only service role can touch this table; no public access
alter table otp_tokens enable row level security;
