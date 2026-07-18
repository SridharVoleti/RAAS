-- ============================================================
-- Certificates are only issued for courses in specific paths.
-- Admin-managed via the Paths page (no hardcoded slugs in code).
--
-- Run in Supabase SQL Editor (as postgres / service role).
-- Idempotent — safe to run more than once.
-- ============================================================

ALTER TABLE paths ADD COLUMN IF NOT EXISTS certificates_enabled BOOLEAN NOT NULL DEFAULT false;

UPDATE paths SET certificates_enabled = true WHERE slug IN ('raas', 'daas');
