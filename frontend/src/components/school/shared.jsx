import { useTranslation } from '../../i18n/translations';

// ---- editable rows: one row = one subject taught by one teacher in one grade, over several classrooms ----
// { uid, ids: [existing subject record ids], name, teacherId, grade, sections: ['A','B'],
//   orig: { name, teacherId, grade, sections } | null (new row), tab, removed, teacherText? (what the Excel said) }

let counter = 0;
export const newUid = () => `r${++counter}`;

export function rowFromServer(r) {
  return {
    uid: newUid(), ids: r.ids, name: r.name, teacherId: r.teacherId, grade: r.grade, sections: r.sections,
    orig: { name: r.name, teacherId: r.teacherId, grade: r.grade, sections: r.sections }, tab: r.grade, removed: false
  };
}

export function blankRow(grade = '') {
  return { uid: newUid(), ids: [], name: '', teacherId: '', grade, sections: [], orig: null, tab: grade, removed: false };
}

export function isDirty(row) {
  if (!row.orig) return true;
  return row.name.trim() !== row.orig.name || Number(row.teacherId) !== row.orig.teacherId
    || row.grade !== row.orig.grade || row.sections.join() !== row.orig.sections.join();
}

export const toPayload = (row) => ({
  clientId: row.uid, ids: row.ids, name: row.name.trim(), teacherId: Number(row.teacherId), grade: row.grade, sections: row.sections
});

// Problems the browser can already see, per field (the server checks again when saving)
export function rowIssues(row, t) {
  const out = {};
  if (!row.name.trim()) out.name = t('scIssueName');
  if (!row.teacherId) out.teacher = t('scIssueTeacher');
  if (!row.grade) out.grade = t('scIssueGrade');
  if (row.sections.length === 0) out.sections = t('scIssueClassrooms');
  return out;
}
export const hasIssues = (issues) => Object.keys(issues).length > 0;

// "1 Mid" keeps its order inside right-to-left text
export const ltr = (text) => `\u202A${text}\u202C`;

export function ClassroomChips({ value, options, onChange, disabled }) {
  return (
    <span style={{ display: 'inline-flex', gap: '4px' }}>
      {options.map((c) => {
        const on = value.includes(c);
        return (
          <button
            key={c}
            type="button"
            disabled={disabled}
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== c) : [...value, c].sort())}
            style={{ ...styles.chip, ...(on ? styles.chipOn : null) }}
          >
            {c}
          </button>
        );
      })}
    </span>
  );
}

const ROW_H = 52;
const HEAD_H = 36;
export const VISIBLE_ROWS = 7; // the table shows this many rows, the rest scrolls

// The shared table of subject rows (Section 1 and Section 2).
// `flagged`: uids whose field problems are shown now; `issues`: messages from the server per uid;
// `highlightEdits`: tint the rows that differ from what is saved (Section 1 only).
export function RowsEditor({ rows, teachers, structure, onChange, onRemove, onUndo, flagged = {}, issues = {}, emptyText, showMoveHint = false, highlightEdits = false }) {
  const t = useTranslation();
  return (
    <div style={styles.tableWrap}>
      <div style={{ ...styles.scroll, maxHeight: HEAD_H + VISIBLE_ROWS * ROW_H }}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={{ ...styles.th, width: '26%' }}>{t('scColSubject')}</th>
              <th style={{ ...styles.th, width: '24%' }}>{t('scColTeacher')}</th>
              <th style={{ ...styles.th, width: '16%' }}>{t('grade')}</th>
              <th style={styles.th}>{t('scColClassrooms')}</th>
              <th style={{ ...styles.th, width: '44px' }} />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={5} style={styles.empty}>{emptyText}</td></tr>
            )}
            {rows.map((row) => {
              const field = flagged[row.uid] ? rowIssues(row, t) : {};
              const server = issues[row.uid] || [];
              const dirty = !row.removed && isDirty(row);
              const bg = hasIssues(field) || server.length ? styles.rowBad : dirty && highlightEdits ? styles.rowDirty : null;
              const off = row.removed;
              return (
                <tr key={row.uid} style={{ ...styles.tr, ...bg, ...(off ? styles.rowRemoved : null) }}>
                  <td style={styles.td}>
                    <input
                      type="text"
                      value={row.name}
                      placeholder={t('scSubjectPlaceholder')}
                      disabled={off}
                      onChange={(e) => onChange(row.uid, { name: e.target.value })}
                      style={styles.input}
                    />
                    {field.name && <div style={styles.issue}>{field.name}</div>}
                    {server.map((p) => <div key={p} style={styles.issue}>{p}</div>)}
                  </td>
                  <td style={styles.td}>
                    <select
                      value={row.teacherId}
                      disabled={off}
                      onChange={(e) => onChange(row.uid, { teacherId: e.target.value ? Number(e.target.value) : '' })}
                      style={{ ...styles.input, ...(field.teacher || (!row.teacherId && row.teacherText) ? styles.inputBad : null) }}
                    >
                      <option value="">{t('scPickTeacher')}</option>
                      {teachers.map((tc) => <option key={tc.id} value={tc.id}>{tc.name}</option>)}
                    </select>
                    {field.teacher && <div style={styles.issue}>{field.teacher}</div>}
                    {!row.teacherId && row.teacherText && (
                      <div style={styles.issue}>{t('scExcelSaid')}: “{row.teacherText}”</div>
                    )}
                  </td>
                  <td style={styles.td}>
                    <select
                      value={row.grade}
                      disabled={off}
                      onChange={(e) => onChange(row.uid, { grade: e.target.value })}
                      style={{ ...styles.input, ...(field.grade || (!row.grade && row.gradeText) ? styles.inputBad : null) }}
                    >
                      <option value="">{t('grade')}</option>
                      {structure.grades.map((g) => <option key={g} value={g}>{ltr(g)}</option>)}
                    </select>
                    {field.grade && <div style={styles.issue}>{field.grade}</div>}
                    {!row.grade && row.gradeText && <div style={styles.issue}>{t('scExcelSaid')}: “{row.gradeText}”</div>}
                    {showMoveHint && dirty && row.orig && row.grade && row.grade !== row.tab && (
                      <div style={styles.hint}>{t('scMovesTo')} {ltr(row.grade)}</div>
                    )}
                  </td>
                  <td style={styles.td}>
                    <ClassroomChips
                      value={row.sections}
                      options={structure.classrooms}
                      disabled={off}
                      onChange={(sections) => onChange(row.uid, { sections })}
                    />
                    {field.sections && <div style={styles.issue}>{field.sections}</div>}
                    {row.badSections && <div style={styles.issue}>{t('scExcelSaid')}: “{row.badSections}”</div>}
                  </td>
                  <td style={{ ...styles.td, textAlign: 'center' }}>
                    {off ? (
                      <button type="button" onClick={() => onUndo(row.uid)} style={styles.iconBtn} title={t('scUndo')} aria-label={t('scUndo')}>↩</button>
                    ) : (
                      <button type="button" onClick={() => onRemove(row.uid)} style={{ ...styles.iconBtn, color: 'var(--mark-fail)' }} title={t('scDeleteRow')} aria-label={t('scDeleteRow')}>✕</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export const styles = {
  tableWrap: { border: '1px solid var(--border)', borderRadius: '8px', overflowX: 'auto' },
  scroll: { overflowY: 'auto' },
  table: { width: '100%', minWidth: '600px', borderCollapse: 'collapse', fontSize: '0.812rem' },
  th: {
    position: 'sticky', top: 0, zIndex: 1, background: 'var(--surface-alt)', color: 'var(--text-primary)',
    textAlign: 'start', padding: '0 10px', height: `${HEAD_H}px`, fontWeight: 600, fontSize: '0.75rem', borderBottom: '1px solid var(--border)'
  },
  tr: { height: `${ROW_H}px` },
  td: { padding: '5px 10px', borderTop: '1px solid var(--border)', verticalAlign: 'middle' },
  empty: { padding: '18px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.812rem' },
  rowDirty: { background: 'var(--nav-active-bg)' },
  rowBad: { background: 'color-mix(in srgb, var(--mark-fail) 14%, transparent)' },
  rowRemoved: { opacity: 0.55, textDecoration: 'line-through' },
  input: {
    padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)',
    color: 'var(--text-primary)', fontSize: '0.812rem', width: '100%', boxSizing: 'border-box'
  },
  inputBad: { borderColor: 'var(--mark-fail)' },
  issue: { color: 'var(--mark-fail)', fontSize: '0.688rem', marginTop: '2px', textDecoration: 'none' },
  hint: { color: 'var(--text-secondary)', fontSize: '0.688rem', marginTop: '2px' },
  chip: {
    width: '28px', height: '28px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg)',
    color: 'var(--text-secondary)', fontSize: '0.75rem', cursor: 'pointer', padding: 0
  },
  chipOn: { background: 'var(--cobalt)', borderColor: 'var(--cobalt)', color: 'var(--on-cobalt)' },
  iconBtn: { border: 'none', background: 'transparent', color: 'var(--text-primary)', fontSize: '1rem', cursor: 'pointer', padding: '4px 8px' },

  // shared bits of the section cards
  card: { border: '1px solid var(--border)', borderRadius: '10px', padding: '14px', marginBottom: '1.5rem' },
  h3: { fontSize: '0.938rem', fontWeight: 500, margin: '0 0 4px', color: 'var(--text-primary)' },
  help: { fontSize: '0.812rem', color: 'var(--text-secondary)', margin: '0 0 10px' },
  bar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '10px' },
  note: { fontSize: '0.75rem', color: 'var(--text-secondary)' },
  ok: { fontSize: '0.812rem', color: 'var(--success)', margin: '8px 0 0' },
  err: { fontSize: '0.812rem', color: 'var(--error)', margin: '8px 0 0' },
  primaryBtn: { padding: '8px 14px', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: 'var(--accent-text)', fontSize: '0.812rem', cursor: 'pointer' },
  secondaryBtn: { padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)', fontSize: '0.812rem', cursor: 'pointer' },
  select: { padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)', fontSize: '0.812rem', flex: '1 1 140px' },
  tab: { padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)', fontSize: '0.812rem', cursor: 'pointer' },
  tabOn: { background: 'var(--accent)', color: 'var(--accent-text)', borderColor: 'var(--accent)' }
};
