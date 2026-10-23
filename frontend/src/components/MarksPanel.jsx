import { useEffect, useState } from 'react';
import { api, getStoredUser } from '../api/client';
import { useTranslation } from '../i18n/translations';
import { useSettings } from '../context/SettingsContext';
import { MARK_PERIODS, periodLabel, TERM_LABELS, MONTH_LABELS } from '../constants/markPeriods';

export default function MarksPanel() {
  const user = getStoredUser();
  const t = useTranslation();
  const { settings } = useSettings();

  if (user?.role === 'student') return <StudentReportCard t={t} language={settings.language} user={user} />;
  return <TeacherMarksEntry t={t} language={settings.language} />;
}

const PASS_MARK = 50;
const isFail = (value) => value !== '—' && value !== undefined && Number(value) < PASS_MARK;

function StudentReportCard({ t, language, user }) {
  const [marks, setMarks] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        const [marksData, subjectData] = await Promise.all([api.getMyMarks(), api.getSubjects()]);
        setMarks(marksData);
        setSubjects(subjectData);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function findMark(subjectId, periodKey) {
    const m = marks.find((mk) => mk.subject_id === subjectId && mk.term === periodKey);
    return m ? m.value : '—';
  }

  // (month 1 + month 2) / 2 for a term; blank until both months have a mark
  function termAverage(subjectId, term) {
    const a = marks.find((mk) => mk.subject_id === subjectId && mk.term === `${term}_month1`);
    const b = marks.find((mk) => mk.subject_id === subjectId && mk.term === `${term}_month2`);
    if (!a || !b) return '—';
    const avg = (Number(a.value) + Number(b.value)) / 2;
    return String(Math.round(avg * 100) / 100);
  }

  const lang = language === 'ar' ? 'ar' : 'en';

  return (
    <div style={{ maxWidth: '1000px' }}>
      <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
        <button style={styles.printBtn} onClick={() => window.print()}>{t('printMarks')}</button>
      </div>
      <h2 className="print-only" style={{ margin: '0 0 8px', fontSize: '1.25rem' }}>
        {t('appName')} — {t('marks')} ({new Date().toLocaleDateString()})
      </h2>
      <div style={styles.reportHeader}>
        <div>
          <p style={styles.headerLine}><strong>{t('name')}:</strong> {user?.name}</p>
          <p style={styles.headerLine}><strong>{t('grade')}:</strong> {user?.grade || '—'}</p>
          <p style={styles.headerLine}><strong>{t('classroom')}:</strong> {user?.classroom_section || '—'}</p>
        </div>
        <div>
          <p style={styles.headerLine}><strong>ID:</strong> {user?.id || '—'}</p>
        </div>
      </div>

      {error && <p style={{ color: 'var(--error)', fontSize: '0.812rem' }}>{error}</p>}
      {loading && <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{t('loading')}</p>}

      {!loading && (
        <div style={{ overflowX: 'auto' }}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th} rowSpan={2}>{t('subjects')}</th>
                <th style={styles.th} colSpan={3}>{TERM_LABELS.sem1[lang]}</th>
                <th style={styles.th} rowSpan={2}>{periodLabel('midyear', language)}</th>
                <th style={styles.th} colSpan={3}>{TERM_LABELS.sem2[lang]}</th>
                <th style={styles.th} rowSpan={2}>{periodLabel('final', language)}</th>
              </tr>
              <tr>
                <th style={styles.th}>{MONTH_LABELS.month1[lang]}</th>
                <th style={styles.th}>{MONTH_LABELS.month2[lang]}</th>
                <th style={styles.thAvg}>{t('average')}</th>
                <th style={styles.th}>{MONTH_LABELS.month1[lang]}</th>
                <th style={styles.th}>{MONTH_LABELS.month2[lang]}</th>
                <th style={styles.thAvg}>{t('average')}</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((s) => (
                <tr key={s.id}>
                  <td style={styles.td}>{s.name}</td>
                  {[
                    ['sem1_month1', false], ['sem1_month2', false], ['sem1', true], ['midyear', false],
                    ['sem2_month1', false], ['sem2_month2', false], ['sem2', true], ['final', false]
                  ].map(([key, avg]) => {
                    const value = avg ? termAverage(s.id, key) : findMark(s.id, key);
                    return (
                      <td key={key} style={{ ...(avg ? styles.tdAvg : styles.tdCenter), ...(isFail(value) ? styles.fail : null) }}>
                        {value}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TeacherMarksEntry({ t, language }) {
  const [structure, setStructure] = useState({ grades: [], classrooms: [] });
  const [subjects, setSubjects] = useState([]);
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedClassroom, setSelectedClassroom] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState(MARK_PERIODS[0].key);
  const [students, setStudents] = useState([]);
  const [values, setValues] = useState({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');

  useEffect(() => {
    Promise.all([api.getSchoolStructure(), api.getSubjects()])
      .then(([struct, subjectList]) => {
        setStructure(struct);
        setSubjects(subjectList);
      })
      .catch((err) => setError(err.message));
  }, []);

  const filteredSubjects = subjects.filter(
    (s) => s.grade === selectedGrade && s.classroom_section === selectedClassroom
  );

  async function loadRoster(subjectId, periodKey) {
    if (!subjectId) return;
    setError('');
    try {
      const [studentList, marks] = await Promise.all([
        api.getSubjectStudents(subjectId),
        api.getSubjectMarks(subjectId)
      ]);
      setStudents(studentList);
      const prefill = {};
      studentList.forEach((s) => {
        const existing = marks.find((m) => m.student_id === s.id && m.term === periodKey);
        prefill[s.id] = existing ? String(existing.value) : '';
      });
      setValues(prefill);
    } catch (err) {
      setError(err.message);
    }
  }

  function handleGradeClassroomChange(grade, classroom) {
    setSelectedGrade(grade);
    setSelectedClassroom(classroom);
    setSelectedSubject('');
    setStudents([]);
    setValues({});
  }

  function handleSubjectChange(subjectId) {
    setSelectedSubject(subjectId);
    if (subjectId) loadRoster(subjectId, selectedPeriod);
  }

  function handlePeriodChange(periodKey) {
    setSelectedPeriod(periodKey);
    if (selectedSubject) loadRoster(selectedSubject, periodKey);
  }

  async function handleSaveAll() {
    setSaving(true);
    setError('');
    setSavedMessage('');
    try {
      for (const student of students) {
        const raw = values[student.id];
        if (raw === '' || raw === undefined) continue;
        await api.addMark({
          subjectId: selectedSubject,
          studentId: student.id,
          value: Number(raw),
          term: selectedPeriod,
          description: ''
        });
      }
      setSavedMessage(t('marksSaved'));
      loadRoster(selectedSubject, selectedPeriod);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: '640px' }}>
      <h2 style={{ fontSize: '1.125rem', fontWeight: 500, marginBottom: '1rem', color: 'var(--text-primary)' }}>
        {t('marks')}
      </h2>

      <div style={styles.filterRow}>
        <select
          value={selectedGrade}
          onChange={(e) => handleGradeClassroomChange(e.target.value, selectedClassroom)}
          style={styles.input}
        >
          <option value="">{t('gradePlaceholder')}</option>
          {structure.grades.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
        <select
          value={selectedClassroom}
          onChange={(e) => handleGradeClassroomChange(selectedGrade, e.target.value)}
          style={styles.input}
        >
          <option value="">{t('classroomPlaceholder')}</option>
          {structure.classrooms.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {selectedGrade && selectedClassroom && (
        <div style={styles.filterRow}>
          <select value={selectedSubject} onChange={(e) => handleSubjectChange(e.target.value)} style={styles.input}>
            <option value="">{t('selectSubject')}</option>
            {filteredSubjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <select value={selectedPeriod} onChange={(e) => handlePeriodChange(e.target.value)} style={styles.input}>
            {MARK_PERIODS.map((p) => (
              <option key={p.key} value={p.key}>{periodLabel(p.key, language)}</option>
            ))}
          </select>
        </div>
      )}

      {error && <p style={{ color: 'var(--error)', fontSize: '0.812rem' }}>{error}</p>}
      {savedMessage && <p style={{ color: 'var(--success)', fontSize: '0.812rem' }}>{savedMessage}</p>}

      {selectedSubject && (
        <>
          {students.length === 0 && (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{t('noStudentsEnrolled')}</p>
          )}
          {students.map((s) => (
            <div key={s.id} style={styles.studentRow}>
              <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-primary)', flex: 1 }}>{s.name}</p>
              <input
                type="number"
                step="0.01"
                value={values[s.id] || ''}
                onChange={(e) => setValues({ ...values, [s.id]: e.target.value })}
                style={{ ...styles.input, width: '90px' }}
              />
            </div>
          ))}
          {students.length > 0 && (
            <button onClick={handleSaveAll} style={styles.primaryBtn} disabled={saving}>
              {saving ? t('saving') : t('saveAllMarks')}
            </button>
          )}
        </>
      )}
    </div>
  );
}

const styles = {
  filterRow: { display: 'flex', gap: '8px', marginBottom: '0.75rem' },
  input: {
    padding: '8px 10px',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text-primary)',
    fontSize: '0.812rem'
  },
  studentRow: { display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0', borderBottom: '1px solid var(--border)' },
  primaryBtn: {
    marginTop: '1rem',
    padding: '8px 14px',
    borderRadius: '8px',
    border: 'none',
    background: 'var(--accent)',
    color: 'var(--accent-text)',
    fontSize: '0.812rem',
    cursor: 'pointer'
  },
  reportHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '1rem',
    border: '1px solid var(--border)',
    borderRadius: '10px',
    marginBottom: '1rem'
  },
  headerLine: { margin: '4px 0', fontSize: '0.875rem', color: 'var(--text-primary)' },
  table: { borderCollapse: 'collapse', width: '100%', minWidth: '820px' },
  th: { border: '1px solid var(--border)', padding: '8px', fontSize: '0.8125rem', color: 'var(--text-primary)', background: 'var(--surface-alt)' },
  td: { border: '1px solid var(--border)', padding: '8px', fontSize: '0.8125rem', color: 'var(--text-primary)' },
  tdCenter: { border: '1px solid var(--border)', padding: '8px', fontSize: '0.8125rem', color: 'var(--text-primary)', textAlign: 'center' },
  fail: { color: 'var(--mark-fail)', fontWeight: 700 },
  printBtn: { border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)', borderRadius: '8px', padding: '6px 14px', fontSize: '0.812rem', cursor: 'pointer' },
  thAvg: { border: '1px solid var(--border)', padding: '8px', fontSize: '0.8125rem', color: 'var(--text-primary)', background: 'var(--cobalt-soft)' },
  tdAvg: { border: '1px solid var(--border)', padding: '8px', fontSize: '0.8125rem', color: 'var(--text-primary)', textAlign: 'center', fontWeight: 600, background: 'var(--cobalt-soft)' }
};
