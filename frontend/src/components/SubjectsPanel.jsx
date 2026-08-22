import { useEffect, useState } from 'react';
import { api, getStoredUser } from '../api/client';
import { useTranslation } from '../i18n/translations';

export default function SubjectsPanel() {
  const [subjects, setSubjects] = useState([]);
  const [form, setForm] = useState({ name: '', grade: '', classroomSection: '' });
  const [error, setError] = useState('');
  const [importResult, setImportResult] = useState(null);
  const [importing, setImporting] = useState(false);
  const [credFilter, setCredFilter] = useState({ grade: '', classroomSection: '' });
  const user = getStoredUser();
  const t = useTranslation();

  async function load() {
    try {
      const s = await api.getSubjects();
      setSubjects(s);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.name || !form.grade || !form.classroomSection) {
      setError(t('fillSubjectFields'));
      return;
    }
    setError('');
    try {
      await api.createSubject(form.name, form.grade, form.classroomSection);
      setForm({ name: '', grade: '', classroomSection: '' });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const result = await api.importUsers(formData);
      setImportResult(result);

      if (result.credentialsFile) {
        const byteChars = atob(result.credentialsFile);
        const byteNumbers = new Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
        const blob = new Blob([new Uint8Array(byteNumbers)], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'student-logins.xlsx';
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  }

  async function handleDownloadCredentials() {
    setError('');
    try {
      const blob = await api.downloadCredentials(credFilter.grade, credFilter.classroomSection);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'student-logins.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    }
  }

  if (user?.role !== 'teacher') {
    return <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{t('onlyTeachersManageSubjects')}</p>;
  }

  return (
    <div style={{ maxWidth: '560px' }}>
      <h2 style={{ fontSize: '1.125rem', fontWeight: 500, marginBottom: '1rem', color: 'var(--text-primary)' }}>
        {t('subjects')}
      </h2>

      <form onSubmit={handleCreate} style={styles.form}>
        <input
          type="text"
          placeholder={t('subjectNamePlaceholder')}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          style={styles.input}
        />
        <input
          type="text"
          placeholder={t('gradePlaceholder')}
          value={form.grade}
          onChange={(e) => setForm({ ...form, grade: e.target.value })}
          style={styles.input}
        />
        <input
          type="text"
          placeholder={t('classroomPlaceholder')}
          value={form.classroomSection}
          onChange={(e) => setForm({ ...form, classroomSection: e.target.value })}
          style={styles.input}
        />
        <button type="submit" style={styles.addBtn}>{t('addSubject')}</button>
      </form>

      {error && <p style={{ color: '#c0392b', fontSize: '0.812rem' }}>{error}</p>}

      <div style={{ marginTop: '1rem' }}>
        {subjects.length === 0 && <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{t('noSubjectsYet')}</p>}
        {subjects.map((s) => (
          <div key={s.id} style={styles.row}>
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-primary)' }}>{s.name}</p>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {t('grade')} {s.grade} · {s.classroom_section}
            </p>
          </div>
        ))}
      </div>

      <hr style={styles.hr} />

      <h3 style={{ fontSize: '0.938rem', fontWeight: 500, marginBottom: '8px', color: 'var(--text-primary)' }}>
        {t('bulkImportTitle')}
      </h3>
      <p style={{ fontSize: '0.812rem', color: 'var(--text-secondary)', marginBottom: '10px' }}>
        {t('bulkImportColumns')}
        <br />{t('bulkImportExplain')}
      </p>
      <input type="file" accept=".xlsx" onChange={handleFileUpload} disabled={importing} />
      {importing && <p style={{ fontSize: '0.812rem', color: 'var(--text-secondary)' }}>{t('importing')}</p>}
      {importResult && (
        <p style={{ fontSize: '0.812rem', color: '#2e7d32' }}>
          {t('created')} {importResult.created}, {t('skipped')} {importResult.skipped} ({t('alreadyExisted')}), {t('enrolled')} {importResult.enrolled}.
          {importResult.credentialsFile && ` ${t('loginSheetDownloaded')}`}
          {importResult.errors?.length > 0 && (
            <span style={{ color: '#c0392b', display: 'block' }}>
              {importResult.errors.length} {t('rowsHadErrors')}
            </span>
          )}
        </p>
      )}

      <hr style={styles.hr} />

      <h3 style={{ fontSize: '0.938rem', fontWeight: 500, marginBottom: '8px', color: 'var(--text-primary)' }}>
        {t('redownloadTitle')}
      </h3>
      <p style={{ fontSize: '0.812rem', color: 'var(--text-secondary)', marginBottom: '10px' }}>
        {t('redownloadExplain')}
      </p>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
        <input
          type="text"
          placeholder={t('gradeOptionalPlaceholder')}
          value={credFilter.grade}
          onChange={(e) => setCredFilter({ ...credFilter, grade: e.target.value })}
          style={styles.input}
        />
        <input
          type="text"
          placeholder={t('classroomOptionalPlaceholder')}
          value={credFilter.classroomSection}
          onChange={(e) => setCredFilter({ ...credFilter, classroomSection: e.target.value })}
          style={styles.input}
        />
      </div>
      <button onClick={handleDownloadCredentials} style={styles.addBtn}>
        {t('downloadLogins')}
      </button>
    </div>
  );
}

const styles = {
  form: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '1rem' },
  input: {
    padding: '8px 10px',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text-primary)',
    fontSize: '0.812rem',
    flex: '1 1 140px'
  },
  addBtn: {
    padding: '8px 14px',
    borderRadius: '8px',
    border: 'none',
    background: 'var(--accent)',
    color: 'var(--accent-text)',
    fontSize: '0.812rem',
    cursor: 'pointer'
  },
  row: { padding: '10px 0', borderBottom: '1px solid var(--border)' },
  hr: { margin: '1.5rem 0', border: 'none', borderTop: '1px solid var(--border)' }
};
