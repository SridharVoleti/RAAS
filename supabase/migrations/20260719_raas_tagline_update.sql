-- Update the RAAS path tagline shown on the home and student home pages.

UPDATE paths
SET
  tagline_en = 'Learn Ramanuja Granthas',
  tagline_te = 'రామానుజ గ్రంథములనును పంక్తి పాఠముగా నేర్చుకోండి'
WHERE slug = 'raas';
