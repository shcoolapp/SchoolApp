import { useEffect, useRef, useState } from 'react';
import { api } from '../../api/client';
import { useTranslation } from '../../i18n/translations';
import { RowsEditor, blankRow, hasIssues, isDirty, ltr, rowFromServer, rowIssues, styles, toPayload } from './shared';

// Section 1: every subject of a grade — who teaches it and in which classrooms — editable in place.
// Nothing reaches the server until Save; deleting classes asks for confirmation first.
export default function ClassesTable({ overview, structure, reload }) {
  const t = useTranslation();
  const [rows, setRows] = useState(() => overview.rows.map(rowFromServer));
  const [tab, setTab] = useState(structure.grades[0] || '');
  const [issues, setIssues] = useState({}); // messages from the server, per row
  const [flagged, setFlagged] = useState({}); // rows whose field problems are shown
  const [confirm, setConfirm] = useState(null); // deletions the admin must approve
  const [stale, setStale] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const skipNext = useRef(false);

  const pending = rows.filter((r) => (r.removed ? r.ids.length > 0 : isDirty(r))).length;

  function reset(data) {
    setRows(data.rows.map(rowFromServer));
    setIssues({});
    setFlagged({});
    setConfirm(null);
    setStale(false);
  }

  // The school data was reloaded by another section: refresh unless there are unsaved edits here
  useEffect(() => {
    if (skipNext.current) { skipNext.current = false; return; }
    if (pending === 0) reset(overview); else setStale(true);
  }, [overview]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = (uid, patch) => {
    setRows((prev) => prev.map((r) => (r.uid === uid ? { ...r, ...patch } : r)));
    setIssues((prev) => ({ ...prev, [uid]: undefined }));
    setMessage('');
  };
  const remove = (uid) => setRows((prev) => prev.flatMap((r) => (r.uid !== uid ? [r] : r.ids.length ? [{ ...r, removed: true }] : [])));
  const undo = (uid) => update(uid, { removed: false });
  const add = () => setRows((prev) => [...prev, { ...blankRow(tab), tab }]);

  async function save(confirmed = false) {
    setError('');
    setMessage('');
    const live = rows.filter((r) => !r.removed && isDirty(r));
    const local = {};
    live.forEach((r) => { if (hasIssues(rowIssues(r, t))) local[r.uid] = true; });
    if (Object.keys(local).length) { setFlagged(local); setError(t('scFixRows')); return; }

    const payload = { rows: live.map(toPayload), deleteIds: rows.filter((r) => r.removed).flatMap((r) => r.ids) };
    setBusy(true);
    try {
      if (!confirmed) {
        const preview = await api.syncSubjects({ ...payload, dryRun: true });
        if (preview.deletions.length > 0) { setConfirm(preview.deletions); return; }
      }
      const res = await api.syncSubjects(payload);
      skipNext.current = true;
      reset(await reload());
      setMessage(`${t('scSaved')} ${t('created')} ${res.created}, ${t('scUpdated')} ${res.updated}, ${t('scDeleted')} ${res.deleted}.`);
    } catch (err) {
      setConfirm(null);
      if (err.data?.errors) {
        const byRow = {};
        err.data.errors.forEach((e) => { (byRow[e.clientId] ||= []).push(e.message); });
        setIssues(byRow);
        setError(t('scFixRows'));
      } else {
        setError(err.message);
      }
    } finally {
      setBusy(false);
    }
  }

  const visible = rows.filter((r) => r.tab === tab);
  const tabPending = (g) => rows.some((r) => r.tab === g && (r.removed ? r.ids.length > 0 : isDirty(r)));

  return (
    <div style={styles.card}>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
        {structure.grades.map((g) => (
          <button key={g} type="button" onClick={() => setTab(g)} style={{ ...styles.tab, ...(g === tab ? styles.tabOn : null) }}>
            {ltr(g)}{tabPending(g) ? ' •' : ''}
          </button>
        ))}
      </div>
      <p style={styles.help}>{t('scClassesHelp')}</p>

      <RowsEditor
        rows={visible}
        teachers={overview.teachers}
        structure={structure}
        onChange={update}
        onRemove={remove}
        onUndo={undo}
        flagged={flagged}
        issues={issues}
        showMoveHint
        highlightEdits
        emptyText={t('scNoRows')}
      />

      <div style={{ ...styles.note, marginTop: '8px', display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
        <span><i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: 'var(--nav-active-bg)', border: '1px solid var(--border)', marginInlineEnd: 5 }} />{t('scEditedLegend')}</span>
        <span>{t('scRowsHint')}</span>
      </div>

      {stale && <p style={styles.err}>{t('scStale')}</p>}
      {confirm && (
        <div style={{ ...styles.card, marginTop: '10px', marginBottom: 0, borderColor: 'var(--mark-fail)' }}>
          <p style={{ ...styles.h3, color: 'var(--mark-fail)' }}>{t('scConfirmTitle')}</p>
          {confirm.map((d) => (
            <p key={d.id} style={{ margin: '4px 0', fontSize: '0.812rem', color: 'var(--text-primary)' }}>
              <strong>{d.name} · {ltr(`${d.grade} ${d.section}`)}</strong>
              <span style={styles.note}> — {d.homework} {t('scHomeworkCount')}, {d.marks} {t('scMarksCount')}, {d.exams} {t('scExamsCount')}, {d.todos} {t('scTodosCount')}</span>
            </p>
          ))}
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
            <button type="button" onClick={() => save(true)} disabled={busy} style={{ ...styles.primaryBtn, background: 'var(--mark-fail)', color: '#fff' }}>{t('scConfirmDelete')}</button>
            <button type="button" onClick={() => setConfirm(null)} style={styles.secondaryBtn}>{t('cancel')}</button>
          </div>
        </div>
      )}
      {error && <p style={styles.err}>{error}</p>}
      {message && <p style={styles.ok}>{message}</p>}

      <div style={styles.bar}>
        <button type="button" onClick={add} style={styles.secondaryBtn}>+ {t('scAddRow')}</button>
        <span style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {pending > 0 && <span style={styles.note}>{pending} {t('scChangesPending')}</span>}
          <button type="button" onClick={() => reset(overview)} disabled={pending === 0 && !stale} style={styles.secondaryBtn}>{t('scDiscard')}</button>
          <button type="button" onClick={() => save()} disabled={busy || pending === 0} style={{ ...styles.primaryBtn, opacity: busy || pending === 0 ? 0.6 : 1 }}>
            {busy ? t('saving') : t('scSave')}
          </button>
        </span>
      </div>
    </div>
  );
}
