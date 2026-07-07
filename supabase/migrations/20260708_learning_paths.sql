-- Learning paths: full (expanded) names for the acronyms + seed RAAS/DAAS rows
-- so the home cards, explore filter, and admin Paths page are all DB-driven.

ALTER TABLE paths ADD COLUMN IF NOT EXISTS full_name_en TEXT NOT NULL DEFAULT '';
ALTER TABLE paths ADD COLUMN IF NOT EXISTS full_name_te TEXT NOT NULL DEFAULT '';

INSERT INTO paths (slug, name, emoji, full_name_en, full_name_te, tagline_en, tagline_te, description_en, description_te, is_active, order_index)
VALUES
  (
    'raas', 'RAAS', 'ॐ',
    'Ramanuja Adhyayana Adhayapaka Samakhya',
    'రామానుజ అధ్యయన అధ్యాపక సమాఖ్య',
    'Vedic & Spiritual Learning',
    'వేద & ఆధ్యాత్మిక అభ్యాసం',
    'Vedic & Spiritual Learning',
    'వేద & ఆధ్యాత్మిక అభ్యాసం',
    true, 1
  ),
  (
    'daas', 'DAAS', '🕊',
    'Dravida Veda Adhyapana Adhayapaka Samakhya',
    'ద్రావిడ వేద అధ్యాపన అధ్యాపక సమాఖ్య',
    'Coming Soon',
    'త్వరలో',
    'Coming Soon',
    'త్వరలో',
    false, 2
  )
ON CONFLICT (slug) DO UPDATE SET
  full_name_en = EXCLUDED.full_name_en,
  full_name_te = EXCLUDED.full_name_te;
