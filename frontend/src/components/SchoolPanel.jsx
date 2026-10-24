import { useEffect, useState } from 'react';
import { api, getStoredUser } from '../api/client';
import { useTranslation } from '../i18n/translations';
import ClassesTable from './school/ClassesTable';
import AssignTeachers from './school/AssignTeachers';
import ImportStudents from './school/ImportStudents';
import LoginSheets from './school/LoginSheets';
import { styles } from './school/shared';

// The School tab (admin only): classes & teachers, bulk teacher assignment, per-classroom student import, login sheets.
// All sections stay mounted while you switch between them, so unsaved edits are not lost.
export default function SchoolPanel() {
  const user = getStoredUser();
  const t = useTranslation();
  const [overview, setOverview] = useState(null); // { teachers, rows }
  const [structure, setStructure] = useState(null);
  const [section, setSection] = useState('classes');
  const [error, setError] = useState('');

  // Fetches the school data; returns it so a section can refresh itself with it.
  async function reload() {
    const data = await api.getSchoolOverview();
    setOverview(data);
    return data;
  }

  useEffect(() => {
    if (user?.role !== 'admin') return;
    Promise.all([reload(), api.getSchoolStructure().then(setStructure)]).catch((err) => setError(err.message));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (user?.role !== 'admin') {
    return <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{t('onlyAdminsManageSchool')}</p>;
  }

  const SECTIONS = [
    { key: 'classes', label: t('scSectionClasses') },
    { key: 'assign', label: t('scSectionAssign') },
    { key: 'students', label: t('scSectionStudents') },
    { key: 'logins', label: t('scSectionLogins') }
  ];
  const ready = overview && structure;
  const show = (key) => ({ display: section === key ? 'block' : 'none' });

  return (
    <div style={{ maxWidth: '760px' }}>
      <h2 style={{ fontSize: '1.125rem', fontWeight: 500, marginBottom: '1rem', color: 'var(--text-primary)' }}>{t('school')}</h2>

      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '1rem' }}>
        {SECTIONS.map((s, i) => (
          <button key={s.key} type="button" onClick={() => setSection(s.key)} style={{ ...styles.tab, ...(section === s.key ? styles.tabOn : null) }}>
            {i + 1} · {s.label}
          </button>
        ))}
      </div>

      {error && <p style={styles.err}>{error}</p>}
      {!ready && !error && <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{t('loading')}</p>}
      {ready && (
        <>
          <div style={show('classes')}><ClassesTable overview={overview} structure={structure} reload={reload} /></div>
          <div style={show('assign')}><AssignTeachers teachers={overview.teachers} structure={structure} reload={reload} /></div>
          <div style={show('students')}><ImportStudents structure={structure} onSaved={() => reload().catch(() => {})} /></div>
          <div style={show('logins')}><LoginSheets structure={structure} /></div>
        </>
      )}
    </div>
  );
}
