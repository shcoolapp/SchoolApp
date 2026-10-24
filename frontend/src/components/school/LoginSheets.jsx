import { useState } from 'react';
import { api } from '../../api/client';
import { useTranslation } from '../../i18n/translations';
import { downloadBlob } from '../../lib/download';
import { ltr, styles } from './shared';

// Section 4: re-download the login sheet (username + password) of a grade / classroom at any time.
export default function LoginSheets({ structure }) {
  const t = useTranslation();
  const [filter, setFilter] = useState({ grade: '', classroomSection: '' });
  const [error, setError] = useState('');

  async function download() {
    setError('');
    try {
      downloadBlob(await api.downloadCredentials(filter.grade, filter.classroomSection), 'student-logins.xlsx');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div style={styles.card}>
      <h3 style={styles.h3}>{t('redownloadTitle')}</h3>
      <p style={styles.help}>{t('redownloadExplain')}</p>
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
      {error && <p style={styles.err}>{error}</p>}
      <button type="button" onClick={download} style={styles.primaryBtn}>{t('downloadLogins')}</button>
    </div>
  );
}
