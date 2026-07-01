export interface QuizLanguage {
  code: string
  label: string
  labelNative: string
}

// To add a new language:
// 1. Add an entry here.
// 2. Run a schema migration:
//      ALTER TABLE quiz_questions
//        ADD COLUMN question_{code} TEXT,
//        ADD COLUMN option_a_{code} TEXT,
//        ADD COLUMN option_b_{code} TEXT,
//        ADD COLUMN option_c_{code} TEXT,
//        ADD COLUMN option_d_{code} TEXT;
// 3. Re-download the CSV template — it auto-reflects the new columns.
export const QUIZ_LANGUAGES: readonly QuizLanguage[] = [
  { code: 'en', label: 'English', labelNative: 'English' },
  { code: 'te', label: 'Telugu',  labelNative: 'తెలుగు'  },
]

/** Kept for legacy references — no language is strictly primary; at least one must be filled. */
export const PRIMARY_QUIZ_LANG = QUIZ_LANGUAGES[0]

/** CSV column headers for all supported languages. */
export function csvTemplateHeaders(): string[] {
  const cols: string[] = []
  for (const lang of QUIZ_LANGUAGES) {
    cols.push(`question_${lang.code}`)
    cols.push(`option_a_${lang.code}`)
    cols.push(`option_b_${lang.code}`)
    cols.push(`option_c_${lang.code}`)
    cols.push(`option_d_${lang.code}`)
  }
  cols.push('correct_option')
  return cols
}

/** Build a DB insert record from a raw CSV row object, for the given chapter. */
export function csvRowToDbRecord(
  row: Record<string, string>,
  chapterId: number,
  orderIndex: number
): Record<string, unknown> {
  const record: Record<string, unknown> = {
    chapter_id:     chapterId,
    order_index:    orderIndex,
    correct_option: row['correct_option']?.trim().toLowerCase(),
  }
  for (const lang of QUIZ_LANGUAGES) {
    record[`question_${lang.code}`] = row[`question_${lang.code}`]?.trim() || null
    record[`option_a_${lang.code}`] = row[`option_a_${lang.code}`]?.trim() || null
    record[`option_b_${lang.code}`] = row[`option_b_${lang.code}`]?.trim() || null
    record[`option_c_${lang.code}`] = row[`option_c_${lang.code}`]?.trim() || null
    record[`option_d_${lang.code}`] = row[`option_d_${lang.code}`]?.trim() || null
  }
  return record
}

/** Validate a CSV row; returns an error string or null.
 *  At least one language must supply the question and all four options. */
export function validateCsvRow(row: Record<string, string>, rowNum: number): string | null {
  const hasCompleteLang = QUIZ_LANGUAGES.some(lang =>
    row[`question_${lang.code}`]?.trim() &&
    row[`option_a_${lang.code}`]?.trim() &&
    row[`option_b_${lang.code}`]?.trim() &&
    row[`option_c_${lang.code}`]?.trim() &&
    row[`option_d_${lang.code}`]?.trim()
  )
  if (!hasCompleteLang)
    return `Row ${rowNum}: at least one complete language set (question + all 4 options) is required`
  if (!['a', 'b', 'c', 'd'].includes(row['correct_option']?.trim().toLowerCase()))
    return `Row ${rowNum}: correct_option must be a, b, c, or d`
  return null
}
