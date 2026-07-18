-- The exam-bank CSV importer (fixed alongside this migration) previously wrote the
-- Telugu question text into question_en instead of question_te, leaving question_te
-- blank. Options were unaffected (correctly stored in the *_te columns), but any
-- viewer with the English language toggle selected saw blank options because
-- option_*_en was always empty for these rows.
--
-- This targets only rows matching that exact bug signature (all four options present
-- in Telugu only, question text present only in the "en" column) so manually entered
-- English-only or bilingual questions are left untouched.
UPDATE exam_questions
SET question_te = question_en,
    question_en = ''
WHERE question_en <> ''
  AND question_te = ''
  AND option_a_en = '' AND option_a_te <> ''
  AND option_b_en = '' AND option_b_te <> ''
  AND option_c_en = '' AND option_c_te <> ''
  AND option_d_en = '' AND option_d_te <> '';
