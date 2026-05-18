-- ============================================================
-- Krishnamargam – Seed Data v1.0
-- Run AFTER schema.sql
-- Courses are created by admin via the dashboard, not seeded.
-- ============================================================

-- ─── PATHS ──────────────────────────────────────────────────
insert into paths (slug, name, emoji, tagline_en, tagline_te, description_en, description_te, is_active, order_index) values
(
  'raas',
  'RAAS',
  '🕉️',
  'Righteous Awakening & Ascension System',
  'పవిత్ర జాగృతి & ఆరోహణ వ్యవస్థ',
  'A structured spiritual education system rooted in ancient Vedic wisdom, designed to guide seekers from foundational knowledge to advanced practice through curated courses in scripture, ritual, music, and philosophy.',
  'వేద జ్ఞానంలో పాతుకున్న, స్క్రిప్చర్, రిచువల్, సంగీతం మరియు తత్వంలో క్యూరేటెడ్ కోర్సుల ద్వారా అన్వేషకులను మూలభూత జ్ఞానం నుండి అధునాతన అభ్యాసం వరకు మార్గనిర్దేశం చేయడానికి రూపొందించిన నిర్మాణాత్మక ఆధ్యాత్మిక విద్యా వ్యవస్థ.',
  true,
  1
),
(
  'daas',
  'DAAS',
  '🌿',
  'Devotional Arts & Ascension System',
  'భక్తి కళలు & ఆరోహణ వ్యవస్థ',
  'Coming soon — an immersive path dedicated to devotional arts, bhakti yoga, classical Indian dance, and sacred music traditions.',
  'త్వరలో వస్తోంది — భక్తి కళలు, భక్తి యోగా, శాస్త్రీయ భారతీయ నృత్యం మరియు పవిత్ర సంగీత సంప్రదాయాలకు అంకితమైన ఒక విస్తృతమైన మార్గం.',
  false,
  2
)
on conflict (slug) do nothing;
