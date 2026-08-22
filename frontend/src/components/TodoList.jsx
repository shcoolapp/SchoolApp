import { useEffect, useState } from 'react';
import { api, getStoredUser } from '../api/client';
import { useTranslation } from '../i18n/translations';

export default function TodoList() {
  const [todos, setTodos] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ subjectId: '', activityDate: '', description: '' });
  const user = getStoredUser();
  const translate = useTranslation();

  async function load() {
    try {
      const [todoData, subjectData] = await Promise.all([api.getTodos(), api.getSubjects()]);
      setTodos(todoData);
      setSubjects(subjectData);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleAdd(e) {
    e.preventDefault();
    if (!form.subjectId || !form.activityDate || !form.description) {
      setError(translate('fillSubjectFields'));
      return;
    }
    setError('');
    try {
      await api.createTodo(form);
      setForm({ subjectId: '', activityDate: '', description: '' });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(id) {
    try {
      await api.deleteTodo(id);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div style={{ maxWidth: '560px' }}>
      <h2 style={{ fontSize: '1.125rem', fontWeight: 500, marginBottom: '1rem', color: 'var(--text-primary)' }}>
        {translate('todoList')}
      </h2>

      {user?.role === 'teacher' && (
        <form onSubmit={handleAdd} style={styles.form}>
          <select
            value={form.subjectId}
            onChange={(e) => setForm({ ...form, subjectId: e.target.value })}
            style={styles.input}
          >
            <option value="">{translate('selectSubject')}</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <input
            type="date"
            value={form.activityDate}
            onChange={(e) => setForm({ ...form, activityDate: e.target.value })}
            style={styles.input}
          />
          <input
            type="text"
            placeholder={translate('whatsTheActivity')}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            style={styles.input}
          />
          <button type="submit" style={styles.addBtn}>{translate('add')}</button>
        </form>
      )}

      {error && <p style={{ color: '#c0392b', fontSize: '0.812rem' }}>{error}</p>}

      <div style={{ marginTop: '1rem' }}>
        {todos.length === 0 && (
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{translate('noActivitiesYet')}</p>
        )}
        {todos.map((item) => (
          <div key={item.id} style={styles.row}>
            <div>
              <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-primary)' }}>{item.description}</p>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                {item.subject_name} · {item.activity_date.slice(0, 10)}
              </p>
            </div>
            {user?.role === 'teacher' && (
              <button onClick={() => handleDelete(item.id)} style={styles.deleteBtn}>
                {translate('remove')}
              </button>
            )}
          </div>
        ))}
      </div>
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
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 0',
    borderBottom: '1px solid var(--border)'
  },
  deleteBtn: {
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text-primary)',
    borderRadius: '8px',
    padding: '4px 10px',
    fontSize: '0.75rem',
    cursor: 'pointer'
  }
};
