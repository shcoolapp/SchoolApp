import { useRef, useState } from 'react';
import { api } from '../../api/client';
import { useTranslation } from '../../i18n/translations';
import { downloadBase64Xlsx } from '../../lib/download';
import { RowsEditor, blankRow, hasIssues, isNewTeacher, newUid, rowIssues, styles, toPayload } from './shared';

// Section 2: assign teachers to subjects in bulk — by hand, or from an Excel file that is loaded
// into the editable table first. Saving only adds assignments; it never removes or duplicates existing ones.
export default function AssignTeachers({ teachers, structure, reload }) {
  const t = useTranslation();
  const [rows, setRows] = useState([]);
  const [issues, setIssues] = useState({}); // messages from the server, per row
  const [flagged, setFlagged] = useState({}); // rows whose field problems are shown (Excel rows at once, the rest after a save attempt)
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const fileRef = useRef(null);

  const update = (uid, patch) => {
    setRows((prev) => prev.map((r) => (r.uid === uid ? { ...r, ...patch } : r)));
    setIssues((prev) => ({ ...prev, [uid]: undefined }));
  };
  const remove = (uid) => setRows((prev) => prev.filter((r) => r.uid !== uid));

  // rows that cannot be saved yet (the "Excel said …" notes disappear once the cell is fixed)
  const newTeacherCount = new Set(rows.filter(isNewTeacher).map((r) => r.teacherText.trim().replace(/\s+/g, ' ').toLowerCase())).size;
  const bad = rows.filter((r) => hasIssues(rowIssues(r, t)) || issues[r.uid]);

  async function handleFile(e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setError(''); setMessage(''); setBusy(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { rows: parsed } = await api.previewSubjectImport(formData);
      const mapped = parsed.map((p) => {
        const validSections = p.sections.filter((c) => structure.classrooms.includes(c));
        const invalid = p.sections.filter((c) => !structure.classrooms.includes(c));
        const gradeOk = structure.grades.includes(p.grade);
        return {
          ...blankRow(gradeOk ? p.grade : ''), uid: newUid(), name: p.name, teacherId: p.teacherId ?? '', teacherText: p.teacherId ? '' : p.teacherText, teacherAmbiguous: !!p.teacherAmbiguous,
          gradeText: gradeOk ? '' : p.grade, sections: validSections, badSections: invalid.join(', ')
        };
      });
      setRows((prev) => [...prev, ...mapped]);
      setFlagged((prev) => ({ ...prev, ...Object.fromEntries(mapped.map((r) => [r.uid, true])) }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setError(''); setMessage('');
    if (bad.length) {
      setFlagged(Object.fromEntries(rows.map((r) => [r.uid, true])));
      setError(t('scFixRows'));
      return;
    }
    setBusy(true);
    try {
      const res = await api.syncSubjects({ rows: rows.map(toPayload), deleteIds: [], returnCredentials: true });
      if (res.credentialsFile) downloadBase64Xlsx(res.credentialsFile, 'teacher-logins.xlsx');
      setRows([]); setIssues({}); setFlagged({});
      setMessage(
        `${t('scSaved')} ${t('created')} ${res.created}, ${t('skipped')} ${res.skipped} (${t('alreadyExisted')}), ${t('enrolled')} ${res.enrolled}.`
        + (res.teachersCreated ? ` ${res.teachersCreated} ${t('scTeachersCreated')}` : '')
        + (res.credentialsFile ? ` ${t('teacherLoginSheetDownloaded')}` : '')
      );
      await reload();
    } catch (err) {
      if (err.data?.errors) {
        const byRow = {};
        err.data.errors.forEach((x) => { (byRow[x.clientId] ||= []).push(x.message); });
        setIssues(byRow);
        setError(t('scFixRows'));
      } else {
        setError(err.message);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={styles.card}>
      <h3 style={styles.h3}>{t('scAssignTitle')}</h3>
      <p style={styles.help}>{t('scAssignHelp')}</p>
      <div style={{ ...styles.bar, marginTop: 0, marginBottom: '10px' }}>
        <span style={{ display: 'flex', gap: '8px' }}>
          <button type="button" onClick={() => setRows((prev) => [...prev, blankRow()])} style={styles.secondaryBtn}>+ {t('scAddRow')}</button>
          <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} style={styles.secondaryBtn}>⬆ {t('scUploadExcel')}</button>
          <input ref={fileRef} type="file" accept=".xlsx" onChange={handleFile} style={{ display: 'none' }} />
        </span>
        {rows.length > 0 && (
          <span style={styles.note}>
            {rows.length} {t('scRowsCount')}{bad.length > 0 && ` · ${bad.length} ${t('scNeedAttention')}`}
            {newTeacherCount > 0 && ` · ${newTeacherCount} ${t('scNewTeachersCount')}`}
          </span>
        )}
      </div>

      <RowsEditor
        rows={rows}
        teachers={teachers}
        structure={structure}
        onChange={update}
        onRemove={remove}
        onUndo={() => {}}
        flagged={flagged}
        issues={issues}
        emptyText={t('scNoAssignRows')}
      />

      {error && <p style={styles.err}>{error}</p>}
      {message && <p style={styles.ok}>{message}</p>}
      <div style={styles.bar}>
        <span style={styles.note}>{t('scAssignNote')}</span>
        <span style={{ display: 'flex', gap: '8px' }}>
          {rows.length > 0 && <button type="button" onClick={() => { setRows([]); setIssues({}); setFlagged({}); }} style={styles.secondaryBtn}>{t('scClear')}</button>}
          <button type="button" onClick={save} disabled={busy || rows.length === 0} style={{ ...styles.primaryBtn, opacity: busy || rows.length === 0 ? 0.6 : 1 }}>
            {busy ? t('saving') : t('scSaveToServer')}
          </button>
        </span>
      </div>
    </div>
  );
}
