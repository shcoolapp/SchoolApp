import { useEffect, useRef, useState } from 'react';
import { api } from '../../api/client';
import { useTranslation } from '../../i18n/translations';
import { downloadBase64Xlsx } from '../../lib/download';
import { ltr, newUid, styles } from './shared';

const key = (name) => name.trim().replace(/\s+/g, ' ').toLowerCase();

// Section 3: import the students of ONE classroom. The admin picks the grade and classroom, uploads a sheet
// of names, reviews/edits the list in the browser, and only then saves it to the server.
export default function ImportStudents({ structure, onSaved }) {
  const t = useTranslation();
  const [grade, setGrade] = useState('');
  const [section, setSection] = useState('');
  const [existing, setExisting] = useState([]); // students already in this classroom
  const [list, setList] = useState([]); // [{ uid, name }]
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const fileRef = useRef(null);

  async function loadExisting() {
    if (!grade || !section) { setExisting([]); return; }
    try {
      setExisting(await api.getClassStudents(grade, section));
    } catch (err) {
      setError(err.message);
    }
  }
  useEffect(() => { loadExisting(); }, [grade, section]); // eslint-disable-line react-hooks/exhaustive-deps

  // status of each row: new / empty / duplicate in the list / already in the classroom
  const taken = new Set(existing.map((s) => key(s.name)));
  const seen = new Set();
  const statuses = list.map((r) => {
    const k = key(r.name);
    if (!k) return 'empty';
    if (taken.has(k)) return 'exists';
    if (seen.has(k)) return 'dup';
    seen.add(k);
    return 'new';
  });
  const newCount = statuses.filter((s) => s === 'new').length;
  const skipCount = statuses.filter((s) => s === 'exists' || s === 'dup').length;

  async function handleFile(e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setError(''); setMessage('');
    if (!grade || !section) { setError(t('scChooseClassFirst')); return; }
    setBusy(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { names } = await api.previewStudentImport(formData);
      setList(names.map((name) => ({ uid: newUid(), name })));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setError(''); setMessage('');
    const names = list.filter((_, i) => statuses[i] === 'new').map((r) => r.name.trim());
    setBusy(true);
    try {
      const res = await api.importStudents({ grade, classroomSection: section, names });
      if (res.credentialsFile) downloadBase64Xlsx(res.credentialsFile, `student-logins-${grade.replace(/\s+/g, '')}-${section}.xlsx`);
      setList([]);
      setMessage(`${t('scSaved')} ${t('created')} ${res.created}, ${t('skipped')} ${res.skipped} (${t('alreadyExisted')}), ${t('enrolled')} ${res.enrolled}.${res.credentialsFile ? ` ${t('loginSheetDownloaded')}` : ''}`);
      await loadExisting();
      onSaved?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const label = { new: t('scStatusNew'), empty: t('scStatusEmpty'), dup: t('scStatusDup'), exists: t('scStatusExists') };

  return (
    <div style={styles.card}>
      <h3 style={styles.h3}>{t('scStudentsTitle')}</h3>
      <p style={styles.help}>{t('scStudentsHelp')}</p>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
        <select value={grade} onChange={(e) => setGrade(e.target.value)} style={styles.select}>
          <option value="">{t('grade')}</option>
          {structure.grades.map((g) => <option key={g} value={g}>{ltr(g)}</option>)}
        </select>
        <select value={section} onChange={(e) => setSection(e.target.value)} style={styles.select}>
          <option value="">{t('scClassroom')}</option>
          {structure.classrooms.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} style={{ ...styles.secondaryBtn, flex: 'none' }}>⬆ {t('scUploadExcel')}</button>
        <input ref={fileRef} type="file" accept=".xlsx" onChange={handleFile} style={{ display: 'none' }} />
      </div>
      {grade && section && <p style={{ ...styles.note, margin: '0 0 8px' }}>{existing.length} {t('scAlreadyInClass')}</p>}

      <div style={styles.tableWrap}>
        <div style={{ ...styles.scroll, maxHeight: 36 + 7 * 52 }}>
          <table style={{ ...styles.table, minWidth: '420px' }}>
            <thead>
              <tr>
                <th style={{ ...styles.th, width: '44px' }}>#</th>
                <th style={styles.th}>{t('scStudentName')}</th>
                <th style={{ ...styles.th, width: '34%' }}>{t('scStatus')}</th>
                <th style={{ ...styles.th, width: '44px' }} />
              </tr>
            </thead>
            <tbody>
              {list.length === 0 && <tr><td colSpan={4} style={styles.empty}>{t('scNoStudentRows')}</td></tr>}
              {list.map((r, i) => {
                const st = statuses[i];
                const problem = st !== 'new';
                return (
                  <tr key={r.uid} style={{ ...styles.tr, ...(problem ? styles.rowBad : null) }}>
                    <td style={styles.td}>{i + 1}</td>
                    <td style={styles.td}>
                      <input
                        type="text"
                        value={r.name}
                        onChange={(e) => setList((prev) => prev.map((x) => (x.uid === r.uid ? { ...x, name: e.target.value } : x)))}
                        style={{ ...styles.input, ...(problem ? styles.inputBad : null) }}
                      />
                    </td>
                    <td style={{ ...styles.td, color: problem ? 'var(--mark-fail)' : 'var(--text-secondary)', fontSize: '0.75rem' }}>{label[st]}</td>
                    <td style={{ ...styles.td, textAlign: 'center' }}>
                      <button type="button" onClick={() => setList((prev) => prev.filter((x) => x.uid !== r.uid))} style={{ ...styles.iconBtn, color: 'var(--mark-fail)' }} aria-label={t('scDeleteRow')}>✕</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {error && <p style={styles.err}>{error}</p>}
      {message && <p style={styles.ok}>{message}</p>}
      <div style={styles.bar}>
        <span style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => setList((prev) => [...prev, { uid: newUid(), name: '' }])} style={styles.secondaryBtn}>+ {t('scAddStudent')}</button>
          {list.length > 0 && <button type="button" onClick={() => setList([])} style={styles.secondaryBtn}>{t('scClear')}</button>}
          {skipCount > 0 && <span style={styles.note}>{skipCount} {t('scWillBeSkipped')}</span>}
        </span>
        <button type="button" onClick={save} disabled={busy || !grade || !section || newCount === 0} style={{ ...styles.primaryBtn, opacity: busy || !grade || !section || newCount === 0 ? 0.6 : 1 }}>
          {busy ? t('saving') : `${t('scSaveStudents')} (${newCount})`}
        </button>
      </div>
    </div>
  );
}
