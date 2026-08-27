import { useEffect, useState } from 'react';
import { api, getStoredUser } from '../api/client';
import { useTranslation } from '../i18n/translations';

export default function MarksPanel() {
  const user = getStoredUser();
  const t = useTranslation();

  if (user?.role === 'student') return <StudentMarks t={t} />;
  return <TeacherMarks t={t} />;
}

function StudentMarks({ t }) {
  const [marks, setMarks] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        const data = await api.getMyMarks();
        setMarks(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div style={{ maxWidth: '560px' }}>
      <h2 style={{ fontSize: '1.125rem', fontWeight: 500, marginBottom: '1rem', color: 'var(--text-primary)' }}>
        {t('marks')}
      </h2>
      {error && <p style={{ color: '#c0392b', fontSize: '0.812rem' }}>{error}</p>}
      {loading && <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{t('loading')}</p>}
      {!loading && marks.length === 0 && (
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{t('noMarksYet')}</p>
      )}
      {marks.map((m) => (
        <div key={m.id} style={styles.row}>
          <div>
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-primary)' }}>{m.subject_name}</p>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {m.description || m.term || ''}
            </p>
          </div>
          <p style={{ margin: 0, fontSize: '1rem', fontWeight: 500, color: 'var(--text-primary)' }}>{m.value}</p>
        </div>
      ))}
    </div>
  );
}

function TeacherMarks({ t }) {
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [students, setStudents] = useState([]);
  const [subjectMarks, setSubjectMarks] = useState([]);
  const [form, setForm] = useState({ studentId: '', value: '', term: '', description: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getSubjects().then(setSubjects).catch((err) => setError(err.message));
  }, []);

  async function loadSubjectData(subjectId) {
    setError('');
    try {
      const [studentList, marks] = await Promise.all([
        api.getSubjectStudents(subjectId),
        api.getSubjectMarks(subjectId)
      ]);
      setStudents(studentList);
      setSubjectMarks(marks);
    } catch (err) {
      setError(err.message);
    }
  }

  function handleSubjectChange(id) {
    setSelectedSubject(id);
    setForm({ studentId: '', value: '', term: '', description: '' });
    if (id) loadSubjectData(id);
    else {
      setStudents([]);
      setSubjectMarks([]);
    }
  }

  async function handleAddMark(e) {
    e.preventDefault();
    if (!form.studentId || form.value === '') {
      setError(t('fillMarkFields'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.addMark({ ...form, subjectId: selectedSubject, value: Number(form.value) });
      setForm({ studentId: '', value: '', term: '', description: '' });
      loadSubjectData(selectedSubject);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: '560px' }}>
      <h2 style={{ fontSize: '1.125rem', fontWeight: 500, marginBottom: '1rem', color: 'var(--text-primary)' }}>
        {t('marks')}
      </h2>

      <select
        value={selectedSubject}
        onChange={(e) => handleSubjectChange(e.target.value)}
        style={{ ...styles.input, marginBottom: '1rem' }}
      >
        <option value="">{t('selectSubject')}</option>
        {subjects.map((s) => (
          <option key={s.id} value={s.id}>{s.name} — {s.grade} {s.classroom_section}</option>
        ))}
      </select>

      {selectedSubject && (
        <>
          <form onSubmit={handleAddMark} style={styles.form}>
            <select
              value={form.studentId}
              onChange={(e) => setForm({ ...form, studentId: e.target.value })}
              style={styles.input}
            >
              <option value="">{t('selectStudent')}</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <input
              type="number"
              step="0.01"
              placeholder={t('markValue')}
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
              style={styles.input}
            />
            <input
              type="text"
              placeholder={t('termOptional')}
              value={form.term}
              onChange={(e) => setForm({ ...form, term: e.target.value })}
              style={styles.input}
            />
            <input
              type="text"
              placeholder={t('descriptionOptional')}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              style={styles.input}
            />
            <button type="submit" style={styles.primaryBtn} disabled={saving}>
              {saving ? t('saving') : t('addMark')}
            </button>
          </form>

          {error && <p style={{ color: '#c0392b', fontSize: '0.812rem' }}>{error}</p>}

          <h3 style={{ fontSize: '0.9375rem', fontWeight: 500, margin: '1rem 0 0.5rem', color: 'var(--text-primary)' }}>
            {t('existingMarks')}
          </h3>
          {students.length === 0 && (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{t('noStudentsEnrolled')}</p>
          )}
          {subjectMarks.length === 0 && students.length > 0 && (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{t('noMarksYet')}</p>
          )}
          {subjectMarks.map((m) => (
            <div key={m.id} style={styles.row}>
              <div>
                <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-primary)' }}>{m.student_name}</p>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  {m.description || m.term || ''}
                </p>
              </div>
              <p style={{ margin: 0, fontSize: '1rem', fontWeight: 500, color: 'var(--text-primary)' }}>{m.value}</p>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

const styles = {
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' },
  form: { display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '1rem', padding: '1rem', border: '1px solid var(--border)', borderRadius: '10px' },
  input: {
    padding: '8px 10px',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text-primary)',
    fontSize: '0.812rem',
    width: '100%',
    boxSizing: 'border-box'
  },
  primaryBtn: {
    padding: '8px 14px',
    borderRadius: '8px',
    border: 'none',
    background: 'var(--accent)',
    color: 'var(--accent-text)',
    fontSize: '0.812rem',
    cursor: 'pointer'
  }
};
