// Canonical grading periods, matching the report-card layout: two semesters,
// each with two monthly marks, plus a mid-year and a final mark. Used as the
// `term` value on mark records so every subject/student report renders the
// same fixed columns.
export const MARK_PERIODS = [
  { key: 'sem1_month1', en: 'Term 1 – Month 1', ar: 'الفصل الأول - الشهر الأول' },
  { key: 'sem1_month2', en: 'Term 1 – Month 2', ar: 'الفصل الأول - الشهر الثاني' },
  { key: 'midyear', en: 'Mid-year', ar: 'نصف السنة' },
  { key: 'sem2_month1', en: 'Term 2 – Month 1', ar: 'الفصل الثاني - الشهر الأول' },
  { key: 'sem2_month2', en: 'Term 2 – Month 2', ar: 'الفصل الثاني - الشهر الثاني' },
  { key: 'final', en: 'Final', ar: 'نهائي' }
];

export function periodLabel(key, language) {
  const p = MARK_PERIODS.find((p) => p.key === key);
  if (!p) return key;
  return language === 'ar' ? p.ar : p.en;
}
