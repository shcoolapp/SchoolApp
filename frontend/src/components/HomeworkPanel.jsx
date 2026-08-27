import { useEffect, useState } from 'react';
import { api, getStoredUser } from '../api/client';
import { useTranslation } from '../i18n/translations';

const BLANK_QUESTION = { questionText: '', optionA: '', optionB: '', optionC: '', optionD: '', correctOption: 'a' };

export default function HomeworkPanel() {
  const user = getStoredUser();
  const t = useTranslation();
  const [items, setItems] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  // Teacher: create-homework form state
  const [showForm, setShowForm] = useState(false);
  const [homeworkType, setHomeworkType] = useState('mcq');
  const [form, setForm] = useState({ subjectId: '', title: '', description: '', dueDate: '' });
  const [questions, setQuestions] = useState([{ ...BLANK_QUESTION }]);
  const [creating, setCreating] = useState(false);

  // Student: file upload state
  const [uploadingId, setUploadingId] = useState(null);
  const [uploadMessage, setUploadMessage] = useState('');

  // Teacher: viewing submissions for a file-based homework
  const [viewingSubmissionsFor, setViewingSubmissionsFor] = useState(null);
  const [submissions, setSubmissions] = useState([]);

  // Student: active quiz state
  const [activeQuiz, setActiveQuiz] = useState(null); // { homeworkId, questions, answers }
  const [result, setResult] = useState(null); // { score, total }

  async function load() {
    setLoading(true);
    setError('');
    try {
      const subjectList = await api.getSubjects();
      setSubjects(subjectList);
      const perSubject = await Promise.all(
        subjectList.map((s) => api.getSubjectHomework(s.id).then((hw) => hw.map((h) => ({ ...h, subject_name: s.name, grade: s.grade, classroom_section: s.classroom_section }))))
      );
      const flat = perSubject.flat().sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
      setItems(flat);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function updateQuestion(index, field, value) {
    setQuestions((prev) => prev.map((q, i) => (i === index ? { ...q, [field]: value } : q)));
  }

  function addQuestion() {
    setQuestions((prev) => [...prev, { ...BLANK_QUESTION }]);
  }

  function removeQuestion(index) {
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.subjectId || !form.title || !form.dueDate) {
      setError(t('fillHomeworkFields'));
      return;
    }
    if (homeworkType === 'mcq') {
      const incomplete = questions.some((q) => !q.questionText || !q.optionA || !q.optionB || !q.optionC || !q.optionD);
      if (incomplete) {
        setError(t('fillAllQuestionFields'));
        return;
      }
    }
    setCreating(true);
    setError('');
    try {
      if (homeworkType === 'mcq') {
        await api.createMcqHomework({ ...form, questions });
      } else {
        await api.createFileHomework(form);
      }
      setForm({ subjectId: '', title: '', description: '', dueDate: '' });
      setQuestions([{ ...BLANK_QUESTION }]);
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleFileSubmit(homeworkId, file) {
    if (!file) return;
    setUploadingId(homeworkId);
    setUploadMessage('');
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      await api.submitHomeworkFile(homeworkId, formData);
      setUploadMessage(t('fileSubmitted'));
    } catch (err) {
      setError(err.message);
    } finally {
      setUploadingId(null);
    }
  }

  async function viewSubmissions(homeworkId) {
    setError('');
    try {
      const subs = await api.getHomeworkSubmissions(homeworkId);
      setSubmissions(subs);
      setViewingSubmissionsFor(homeworkId);
    } catch (err) {
      setError(err.message);
    }
  }

  async function startQuiz(homeworkId) {
    setError('');
    setResult(null);
    try {
      const qs = await api.getHomeworkQuestions(homeworkId);
      setActiveQuiz({ homeworkId, questions: qs, answers: {} });
    } catch (err) {
      setError(err.message);
    }
  }

  function selectAnswer(questionId, option) {
    setActiveQuiz((prev) => ({ ...prev, answers: { ...prev.answers, [questionId]: option } }));
  }

  async function submitQuiz() {
    if (!activeQuiz) return;
    const answers = Object.entries(activeQuiz.answers).map(([questionId, selectedOption]) => ({
      questionId: Number(questionId),
      selectedOption
    }));
    setError('');
    try {
      const res = await api.submitHomeworkAnswers(activeQuiz.homeworkId, answers);
      setResult(res);
      setActiveQuiz(null);
    } catch (err) {
      setError(err.message);
    }
  }

  // --- Student quiz-taking view ---
  if (activeQuiz) {
    return (
      <div style={{ maxWidth: '560px' }}>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 500, marginBottom: '1rem', color: 'var(--text-primary)' }}>
          {t('homework')}
        </h2>
        {activeQuiz.questions.map((q, idx) => (
          <div key={q.id} style={styles.questionBlock}>
            <p style={{ margin: '0 0 8px', fontSize: '0.875rem', color: 'var(--text-primary)' }}>
              {idx + 1}. {q.question_text}
            </p>
            {['a', 'b', 'c', 'd'].map((opt) => (
              <label key={opt} style={styles.optionLabel}>
                <input
                  type="radio"
                  name={`q-${q.id}`}
                  checked={activeQuiz.answers[q.id] === opt}
                  onChange={() => selectAnswer(q.id, opt)}
                />
                {q[`option_${opt}`]}
              </label>
            ))}
          </div>
        ))}
        {error && <p style={{ color: '#c0392b', fontSize: '0.812rem' }}>{error}</p>}
        <button onClick={submitQuiz} style={styles.primaryBtn}>{t('submit')}</button>
        <button onClick={() => setActiveQuiz(null)} style={styles.secondaryBtn}>{t('cancel')}</button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '560px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 500, margin: 0, color: 'var(--text-primary)' }}>{t('homework')}</h2>
        {user?.role === 'teacher' && (
          <button onClick={() => setShowForm(!showForm)} style={styles.primaryBtn}>
            {showForm ? t('cancel') : t('newMcqHomework')}
          </button>
        )}
      </div>

      {result && (
        <p style={styles.resultBanner}>
          {t('yourScore')}: {result.score} / {result.total}
        </p>
      )}

      {showForm && (
        <form onSubmit={handleCreate} style={styles.form}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
            <button
              type="button"
              onClick={() => setHomeworkType('mcq')}
              style={homeworkType === 'mcq' ? styles.primaryBtn : styles.secondaryBtn}
            >
              {t('mcqType')}
            </button>
            <button
              type="button"
              onClick={() => setHomeworkType('file')}
              style={homeworkType === 'file' ? styles.primaryBtn : styles.secondaryBtn}
            >
              {t('fileType')}
            </button>
          </div>
          <select
            value={form.subjectId}
            onChange={(e) => setForm({ ...form, subjectId: e.target.value })}
            style={styles.input}
          >
            <option value="">{t('selectSubject')}</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name} — {s.grade} {s.classroom_section}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder={t('homeworkTitlePlaceholder')}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            style={styles.input}
          />
          <textarea
            placeholder={t('descriptionOptional')}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            style={{ ...styles.input, minHeight: '60px' }}
          />
          <input
            type="datetime-local"
            value={form.dueDate}
            onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
            style={styles.input}
          />

          {homeworkType === 'mcq' && (
            <>
              <h4 style={{ fontSize: '0.9375rem', color: 'var(--text-primary)', margin: '1rem 0 0.5rem' }}>{t('questions')}</h4>
              {questions.map((q, idx) => (
                <div key={idx} style={styles.questionEditor}>
                  <input
                    type="text"
                    placeholder={`${t('question')} ${idx + 1}`}
                    value={q.questionText}
                    onChange={(e) => updateQuestion(idx, 'questionText', e.target.value)}
                    style={styles.input}
                  />
                  {['A', 'B', 'C', 'D'].map((letter) => (
                    <input
                      key={letter}
                      type="text"
                      placeholder={`${t('option')} ${letter}`}
                      value={q[`option${letter}`]}
                      onChange={(e) => updateQuestion(idx, `option${letter}`, e.target.value)}
                      style={styles.input}
                    />
                  ))}
                  <select
                    value={q.correctOption}
                    onChange={(e) => updateQuestion(idx, 'correctOption', e.target.value)}
                    style={styles.input}
                  >
                    <option value="a">{t('correctAnswer')}: A</option>
                    <option value="b">{t('correctAnswer')}: B</option>
                    <option value="c">{t('correctAnswer')}: C</option>
                    <option value="d">{t('correctAnswer')}: D</option>
                  </select>
                  {questions.length > 1 && (
                    <button type="button" onClick={() => removeQuestion(idx)} style={styles.secondaryBtn}>
                      {t('removeQuestion')}
                    </button>
                  )}
                </div>
              ))}
              <button type="button" onClick={addQuestion} style={styles.secondaryBtn}>{t('addQuestion')}</button>
            </>
          )}

          {error && <p style={{ color: '#c0392b', fontSize: '0.812rem' }}>{error}</p>}

          <button type="submit" style={styles.primaryBtn} disabled={creating}>
            {creating ? t('creating') : t('createHomework')}
          </button>
        </form>
      )}

      {loading && <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{t('loading')}</p>}
      {!loading && items.length === 0 && (
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{t('noHomeworkYet')}</p>
      )}

      {uploadMessage && <p style={{ color: '#2e7d32', fontSize: '0.812rem' }}>{uploadMessage}</p>}

      {viewingSubmissionsFor && (
        <div style={styles.submissionsPanel}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ margin: 0, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>{t('submissions')}</h4>
            <button onClick={() => setViewingSubmissionsFor(null)} style={styles.secondaryBtn}>{t('close')}</button>
          </div>
          {submissions.length === 0 && (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.812rem' }}>{t('noSubmissionsYet')}</p>
          )}
          {submissions.map((s) => (
            <div key={s.id} style={styles.row}>
              <p style={{ margin: 0, fontSize: '0.812rem', color: 'var(--text-primary)' }}>{s.student_name}</p>
              <a href={s.drive_file_link} target="_blank" rel="noreferrer" style={styles.link}>{t('viewFile')}</a>
            </div>
          ))}
        </div>
      )}

      {items.map((item) => (
        <div key={item.id} style={styles.row}>
          <div>
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-primary)' }}>{item.title}</p>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {item.subject_name} · {t('due')} {item.due_date.slice(0, 10)}
            </p>
          </div>
          {user?.role === 'student' && item.type === 'mcq' && (
            <button onClick={() => startQuiz(item.id)} style={styles.secondaryBtn}>{t('start')}</button>
          )}
          {user?.role === 'student' && item.type === 'file' && (
            <label style={styles.secondaryBtn}>
              {uploadingId === item.id ? t('uploading') : t('uploadFile')}
              <input
                type="file"
                style={{ display: 'none' }}
                disabled={uploadingId === item.id}
                onChange={(e) => handleFileSubmit(item.id, e.target.files[0])}
              />
            </label>
          )}
          {user?.role === 'teacher' && item.type === 'file' && (
            <button onClick={() => viewSubmissions(item.id)} style={styles.secondaryBtn}>{t('viewSubmissions')}</button>
          )}
        </div>
      ))}
    </div>
  );
}

const styles = {
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' },
  form: { display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '1.5rem', padding: '1rem', border: '1px solid var(--border)', borderRadius: '10px' },
  input: {
    padding: '8px 10px',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text-primary)',
    fontSize: '0.812rem',
    width: '100%',
    boxSizing: 'border-box'
  },
  questionEditor: { display: 'flex', flexDirection: 'column', gap: '6px', padding: '10px', border: '1px solid var(--border)', borderRadius: '8px', marginBottom: '8px' },
  questionBlock: { padding: '10px 0', borderBottom: '1px solid var(--border)' },
  optionLabel: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem', color: 'var(--text-primary)', padding: '4px 0' },
  primaryBtn: {
    padding: '8px 14px',
    borderRadius: '8px',
    border: 'none',
    background: 'var(--accent)',
    color: 'var(--accent-text)',
    fontSize: '0.812rem',
    cursor: 'pointer'
  },
  secondaryBtn: {
    padding: '6px 12px',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text-primary)',
    fontSize: '0.75rem',
    cursor: 'pointer'
  },
  resultBanner: { padding: '10px', borderRadius: '8px', background: 'var(--nav-active-bg)', color: 'var(--text-primary)', fontSize: '0.875rem', marginBottom: '1rem' },
  submissionsPanel: { padding: '1rem', border: '1px solid var(--border)', borderRadius: '10px', marginBottom: '1rem' },
  link: { fontSize: '0.812rem', color: 'var(--accent)' }
};
