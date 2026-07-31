-- Exam bank (exam_questions) is Telugu-only content going forward. Before
-- dropping the English columns, backfill any Telugu column left blank by
-- the CSV-import bug where Telugu text landed in the *_en column instead
-- (see DEFECT_LOG) so that content isn't lost.
update exam_questions set question_te  = question_en  where (question_te  is null or question_te  = '') and question_en  is not null and question_en  <> '';
update exam_questions set option_a_te = option_a_en where (option_a_te is null or option_a_te = '') and option_a_en is not null and option_a_en <> '';
update exam_questions set option_b_te = option_b_en where (option_b_te is null or option_b_te = '') and option_b_en is not null and option_b_en <> '';
update exam_questions set option_c_te = option_c_en where (option_c_te is null or option_c_te = '') and option_c_en is not null and option_c_en <> '';
update exam_questions set option_d_te = option_d_en where (option_d_te is null or option_d_te = '') and option_d_en is not null and option_d_en <> '';

alter table exam_questions
  drop column if exists question_en,
  drop column if exists option_a_en,
  drop column if exists option_b_en,
  drop column if exists option_c_en,
  drop column if exists option_d_en;
