import { useEffect, useState } from 'react';
import { api, getStoredUser } from '../api/client';
import { useTranslation } from '../i18n/translations';

export default function AnnouncementsPanel({ onChanged }) {
  const user = getStoredUser();
  const t = useTranslation();
  const canPost = user?.role === 'teacher' || user?.role === 'admin';

  const [items, setItems] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [structure, setStructure] = useState({ grades: [], classrooms: [] });
  const [form, setForm] = useState({ subjectId: '', grade: '', classroomSection: '', title: '', body: '' });
  const [error, setError] = useState('');
  const [sent, setSent] = useState('');

  async function load() {
    try {
      setItems(await api.getAnnouncements());
      if (user?.role === 'teacher') setSubjects(await api.getSubjects());
      if (user?.role === 'admin') setStructure(await api.getSchoolStructure());
    } catch (err) {
      setError(err.message);
    }
  }
  useEffect(() => { load(); }, []);

  async function handlePost(e) {
    e.preventDefault();
    setError('');
    setSent('');
    if (!form.title.trim()) { setError(t('announcementTitleRequired')); return; }
    if (user.role === 'teacher' && !form.subjectId) { setError(t('selectSubject')); return; }
    try {
      await api.createAnnouncement(
        user.role === 'teacher'
          ? { subjectId: form.subjectId, title: form.title, body: form.body }
          : { grade: form.grade || null, classroomSection: form.classroomSection || null, title: form.title, body: form.body }
      );
      setForm({ ...form, title: '', body: '' });
      setSent(t('announcementSent'));
      load();
      onChanged && onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(id) {
    try {
      await api.deleteAnnouncement(id);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  function audience(a) {
    if (a.subject_name) return a.subject_name;
    if (!a.grade) return t('everyone');
    return a.classroom_section ? `${a.grade} ${a.classroom_section}` : a.grade;
  }

  return (
    <div style={{ maxWidth: '640px' }}>
      <h2 style={styles.h2}>{t('announcements')}</h2>

      {canPost && (
        <form onSubmit={handlePost} style={styles.form}>
          {user.role === 'teacher' ? (
            <select value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: e.target.value })} style={styles.input}>
              <option value="">{t('selectSubject')}</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name} — {s.grade} {s.classroom_section}</option>
              ))}
            </select>
          ) : (
            <div style={styles.row}>
              <select value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value, classroomSection: '' })} style={styles.input}>
                <option value="">{t('everyone')}</option>
                {structure.grades.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
              {form.grade && (
                <select value={form.classroomSection} onChange={(e) => setForm({ ...form, classroomSection: e.target.value })} style={styles.input}>
                  <option value="">{t('allClassrooms')}</option>
                  {structure.classrooms.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
            </div>
          )}
          <input
            type="text"
            placeholder={t('announcementTitle')}
            value={form.title}
            maxLength={200}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            style={styles.input}
          />
          <textarea
            placeholder={t('announcementBody')}
            value={form.body}
            rows={3}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            style={{ ...styles.input, resize: 'vertical', fontFamily: 'inherit' }}
          />
          <button type="submit" style={styles.postBtn}>{t('postAnnouncement')}</button>
        </form>
      )}

      {error && <p style={{ color: 'var(--error)', fontSize: '0.812rem' }}>{error}</p>}
      {sent && <p style={{ color: 'var(--success)', fontSize: '0.812rem' }}>{sent}</p>}

      {items.length === 0 && <p style={styles.muted}>{t('noAnnouncements')}</p>}
      {items.map((a) => (
        <article key={a.id} style={styles.card}>
          <div style={styles.cardHead}>
            <span style={styles.tag}>{audience(a)}</span>
            <span style={styles.muted}>{a.author_name} · {String(a.created_at).slice(0, 10)}</span>
          </div>
          <h3 style={styles.title}>{a.title}</h3>
          {a.body && <p style={styles.body}>{a.body}</p>}
          {(user?.role === 'admin' || (user?.role === 'teacher' && a.author_id === user.id)) && (
            <button onClick={() => handleDelete(a.id)} style={styles.deleteBtn}>{t('remove')}</button>
          )}
        </article>
      ))}
    </div>
  );
}

const styles = {
  h2: { fontSize: '1.125rem', fontWeight: 500, marginBottom: '1rem', color: 'var(--text-primary)' },
  form: { display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '1.25rem' },
  row: { display: 'flex', gap: '8px' },
  input: {
    padding: '8px 10px',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text-primary)',
    fontSize: '0.812rem',
    flex: 1,
    boxSizing: 'border-box',
    width: '100%'
  },
  postBtn: {
    alignSelf: 'flex-start',
    padding: '8px 16px',
    borderRadius: '8px',
    border: 'none',
    background: 'var(--cobalt)',
    color: 'var(--on-cobalt)',
    fontSize: '0.812rem',
    cursor: 'pointer'
  },
  card: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderInlineStart: '4px solid var(--cobalt)',
    borderRadius: '10px',
    padding: '12px 14px',
    marginBottom: '10px'
  },
  cardHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
  tag: { background: 'var(--cobalt)', color: 'var(--on-cobalt)', borderRadius: '6px', padding: '2px 8px', fontSize: '0.688rem', fontWeight: 500 },
  title: { margin: '8px 0 4px', fontSize: '0.938rem', fontWeight: 500, color: 'var(--text-primary)' },
  body: { margin: 0, fontSize: '0.812rem', color: 'var(--text-primary)', whiteSpace: 'pre-wrap' },
  muted: { margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' },
  deleteBtn: { marginTop: '8px', border: 'none', background: 'transparent', color: 'var(--error)', fontSize: '0.75rem', cursor: 'pointer', padding: 0 }
};
