import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useTranslation } from '../i18n/translations';

export default function HomeworkPanel() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const t = useTranslation();

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        const subjects = await api.getSubjects();
        const perSubject = await Promise.all(
          subjects.map((s) => api.getSubjectHomework(s.id).then((hw) => hw.map((h) => ({ ...h, subject_name: s.name }))))
        );
        const flat = perSubject.flat().sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
        setItems(flat);
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
        {t('homework')}
      </h2>

      {error && <p style={{ color: '#c0392b', fontSize: '0.812rem' }}>{error}</p>}
      {loading && <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{t('loading')}</p>}
      {!loading && items.length === 0 && (
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{t('noHomeworkYet')}</p>
      )}

      {items.map((item) => (
        <div key={item.id} style={styles.row}>
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-primary)' }}>{item.title}</p>
          <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            {item.subject_name} · {t('due')} {item.due_date.slice(0, 10)}
          </p>
        </div>
      ))}
    </div>
  );
}

const styles = {
  row: { padding: '10px 0', borderBottom: '1px solid var(--border)' }
};
