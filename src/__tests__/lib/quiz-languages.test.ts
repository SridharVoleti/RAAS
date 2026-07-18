import { describe, it, expect } from 'vitest'
import { isCompleteInLanguage, allCompleteInLanguage } from '@/lib/quiz-languages'

const complete = {
  question_en: 'What is X?', question_te: 'X అంటే ఏమిటి?',
  option_a_en: 'A', option_a_te: 'ఎ',
  option_b_en: 'B', option_b_te: 'బి',
  option_c_en: 'C', option_c_te: 'సి',
  option_d_en: 'D', option_d_te: 'డి',
}

// Mirrors the CSV-import bug: Telugu text landed in question_en, option_*_te
// are populated, option_*_en are empty strings (not undefined).
const teluguOnlyMislabeled = {
  question_en: 'ప్రమాణం అంటే ఏమిటి?', question_te: '',
  option_a_en: '', option_a_te: 'నిరూపణ',
  option_b_en: '', option_b_te: 'జ్ఞాన విషయం',
  option_c_en: '', option_c_te: 'జ్ఞానమిచ్చేది',
  option_d_en: '', option_d_te: 'కొలత',
}

describe('isCompleteInLanguage', () => {
  it('is true when the question and all 4 options have text in the language', () => {
    expect(isCompleteInLanguage(complete, 'en')).toBe(true)
    expect(isCompleteInLanguage(complete, 'te')).toBe(true)
  })

  it('is false when an option is missing in the language', () => {
    const q = { ...complete, option_c_en: '' }
    expect(isCompleteInLanguage(q, 'en')).toBe(false)
  })

  it('is false when the question text is missing in the language', () => {
    const q = { ...complete, question_te: undefined }
    expect(isCompleteInLanguage(q, 'te')).toBe(false)
  })

  it('flags a row with Telugu-only content mislabeled into the en column as incomplete in en', () => {
    expect(isCompleteInLanguage(teluguOnlyMislabeled, 'en')).toBe(false)
  })

  it('also flags that row as incomplete in te, since question_te is blank even though the options are correctly stored there', () => {
    expect(isCompleteInLanguage(teluguOnlyMislabeled, 'te')).toBe(false)
  })
})

describe('allCompleteInLanguage', () => {
  it('is true only when every question in the set is complete', () => {
    expect(allCompleteInLanguage([complete, complete], 'en')).toBe(true)
  })

  it('is false if any one question in the set is incomplete', () => {
    expect(allCompleteInLanguage([complete, teluguOnlyMislabeled], 'en')).toBe(false)
  })

  it('is false for an empty question set', () => {
    expect(allCompleteInLanguage([], 'en')).toBe(false)
  })
})
