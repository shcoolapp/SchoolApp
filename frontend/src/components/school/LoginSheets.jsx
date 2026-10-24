import { useState } from 'react';
import { api } from '../../api/client';
import { useTranslation } from '../../i18n/translations';
import { downloadBlob } from '../../lib/download';
import { ltr, styles } from './shared';

// Section 4: re-download the login sheet (username + password) of teachers, students, or everyone at any time.
export default function LoginSheets({ structure }) {
  const t = useTranslation();
  const [role, setRole] = useState('student'); // student | teacher | all
  const [filter, setFilter] = useState({ grade: '', classroomSection: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function download() {
    setError('');
    setBusy(true);
    try {
      // grade / classroom only apply to students; teachers have neither
      const g = role === 'student' ? filter.grade : '';
      const c = role === 'student' ? filter.classroomSection : '';
      downloadBlob(await api.downloadCredentials(g, c, role), `${role}-logins.xlsx`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const ROLES = [
    { key: 'student', label: t('scLoginsStudents') },
    { key: 'teacher', label: t('scLoginsTeachers') },
    { key: 'all', label: t('scLoginsAll') }
  ];

  return (
    <div style={styles.card}>
      <h3 style={styles.h3}>{t('redownloadTitle')}</h3>
      <p style={styles.help}>{t('redownloadExplain')}</p>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
        {ROLES.map((r) => (
          <button key={r.key} type="button" onClick={() => setRole(r.key)} style={{ ...styles.tab, ...(role === r.key ? styles.tabOn : null) }}>
            {r.label}
          </button>
        ))}
      </div>
      {role === 'student' && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
          <select value={filter.grade} onChange={(e) => setFilter({ ...filter, grade: e.target.value })} style={styles.select}>
            <option value="">{t('gradeOptionalPlaceholder')}</option>
            {structure.grades.map((g) => <option key={g} value={g}>{ltr(g)}</option>)}
          </select>
          <select value={filter.classroomSection} onChange={(e) => setFilter({ ...filter, classroomSection: e.target.value })} style={styles.select}>
            <option value="">{t('classroomOptionalPlaceholder')}</option>
            {structure.classrooms.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      )}
      {error && <p style={styles.err}>{error}</p>}
      <button type="button" onClick={download} disabled={busy} style={{ ...styles.primaryBtn, opacity: busy ? 0.6 : 1 }}>{t('downloadLogins')}</button>
    </div>
  );
}
