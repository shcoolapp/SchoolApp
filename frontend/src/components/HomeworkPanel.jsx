import { useEffect, useRef, useState } from 'react';
import { api, getStoredUser } from '../api/client';
import { useTranslation } from '../i18n/translations';
import AttemptAnswers from './AttemptAnswers';
import { printSheet } from '../lib/printSheet';
import { formatMark, scaled } from '../lib/mark';

const BLANK_QUESTION = { questionText: '', optionA: '', optionB: '', optionC: '', optionD: '', correctOption: 'a' };
const MAX_TEMPLATES = 5;

// Red when the mark is under 50%
const markStyle = (score, total) => (Number(total) > 0 && scaled(score, total, 100) < 50
  ? { color: 'var(--mark-fail)', fontWeight: 700 }
  : { fontWeight: 600 });

function formatClock(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const sec = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

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
  const [form, setForm] = useState({ subjectId: '', title: '', description: '', dueDate: '', durationMinutes: '' });
  const [templates, setTemplates] = useState([[{ ...BLANK_QUESTION }]]); // 1 to 5 templates, each a list of questions
  const [activeTemplate, setActiveTemplate] = useState(0);
  const [creating, setCreating] = useState(false);

  // Student: file upload state
  const [uploadingId, setUploadingId] = useState(null);
  const [uploadMessage, setUploadMessage] = useState('');

  // Teacher: viewing submissions for a file-based homework
  const [viewingSubmissionsFor, setViewingSubmissionsFor] = useState(null);
  const [submissions, setSubmissions] = useState([]);

  // Teacher: viewing official (first attempt) results of an MCQ homework
  const [viewingResultsFor, setViewingResultsFor] = useState(null);
  const [results, setResults] = useState([]);

  // Student: active quiz state
  const [activeQuiz, setActiveQuiz] = useState(null); // { homeworkId, attemptId, isOfficial, templateNumber, endAt, questions, answers }
  const [result, setResult] = useState(null); // { score, total, isOfficial }
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [practiceChoice, setPracticeChoice] = useState({}); // homeworkId -> 'random' | template number
  const quizRef = useRef(null);
  const submittingRef = useRef(false);
  quizRef.current = activeQuiz;

  async function load({ keepError = false } = {}) {
    setLoading(true);
    if (!keepError) setError('');
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
    setTemplates((prev) => prev.map((qs, ti) => (
      ti === activeTemplate ? qs.map((q, i) => (i === index ? { ...q, [field]: value } : q)) : qs
    )));
  }

  function addQuestion() {
    setTemplates((prev) => prev.map((qs, ti) => (ti === activeTemplate ? [...qs, { ...BLANK_QUESTION }] : qs)));
  }

  function removeQuestion(index) {
    setTemplates((prev) => prev.map((qs, ti) => (ti === activeTemplate ? qs.filter((_, i) => i !== index) : qs)));
  }

  function addTemplate() {
    if (templates.length >= MAX_TEMPLATES) return;
    setTemplates((prev) => [...prev, [{ ...BLANK_QUESTION }]]);
    setActiveTemplate(templates.length);
  }

  function removeTemplate() {
    if (templates.length <= 1) return;
    setTemplates((prev) => prev.filter((_, ti) => ti !== activeTemplate));
    setActiveTemplate((i) => Math.max(0, i - 1));
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.subjectId || !form.title || !form.dueDate) {
      setError(t('fillHomeworkFields'));
      return;
    }
    if (homeworkType === 'mcq') {
      if (templates.some((qs) => qs.length === 0)) {
        setError(t('fillEveryTemplate'));
        return;
      }
      const incomplete = templates.some((qs) => qs.some((q) => !q.questionText || !q.optionA || !q.optionB || !q.optionC || !q.optionD));
      if (incomplete) {
        setError(t('fillAllQuestionFields'));
        return;
      }
    }
    setCreating(true);
    setError('');
    try {
      if (homeworkType === 'mcq') {
        await api.createMcqHomework({
          ...form,
          durationMinutes: form.durationMinutes ? Number(form.durationMinutes) : null,
          templates: templates.map((qs) => ({ questions: qs }))
        });
      } else {
        const { durationMinutes, ...fileForm } = form;
        await api.createFileHomework(fileForm);
      }
      setForm({ subjectId: '', title: '', description: '', dueDate: '', durationMinutes: '' });
      setTemplates([[{ ...BLANK_QUESTION }]]);
      setActiveTemplate(0);
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

  async function viewResults(homeworkId) {
    setError('');
    try {
      const rows = await api.getHomeworkResults(homeworkId);
      setResults(rows);
      setViewingResultsFor(homeworkId);
    } catch (err) {
      setError(err.message);
    }
  }

  // Teacher: print menu (which template, with or without the answer key)
  const [printMenuFor, setPrintMenuFor] = useState(null);
  const [printTemplate, setPrintTemplate] = useState('all');

  async function printHomework(homeworkId, kind) {
    setError('');
    try {
      const d = await api.getHomeworkPrintData(homeworkId);
      const templates = printTemplate === 'all' ? d.templates : d.templates.filter((tpl) => tpl.position === Number(printTemplate));
      printSheet({ kind, title: d.title, subjectName: d.subject_name, dueDate: d.due_date, templates }, t);
    } catch (err) {
      setError(err.message);
    }
  }

  // Student: print the questions of the attempt in progress (to work on paper)
  function printQuiz() {
    const hw = items.find((i) => i.id === activeQuiz.homeworkId);
    printSheet({
      kind: 'blank',
      title: hw?.title || t('homework'),
      subjectName: hw?.subject_name,
      dueDate: hw?.due_date,
      templates: [{
        position: activeQuiz.templateNumber,
        questions: activeQuiz.questions.map((q) => ({
          id: q.id, text: q.question_text,
          options: { a: q.option_a, b: q.option_b, c: q.option_c, d: q.option_d }
        }))
      }]
    }, t);
  }

  // The teacher's results panel keeps itself up to date while it is open (students submit at any moment).
  useEffect(() => {
    if (!viewingResultsFor) return undefined;
    const id = setInterval(() => {
      api.getHomeworkResults(viewingResultsFor).then(setResults).catch(() => {});
    }, 10000);
    return () => clearInterval(id);
  }, [viewingResultsFor]);

  // Starts (or resumes) an attempt. The server decides: resume an open one, the official first
  // attempt on a random template, or a practice attempt. The countdown starts on the server.
  async function startAttempt(homeworkId, practiceTemplate) {
    setError('');
    setResult(null);
    try {
      const a = await api.startHomework(homeworkId, practiceTemplate);
      submittingRef.current = false;
      setActiveQuiz({
        homeworkId,
        attemptId: a.attemptId,
        isOfficial: a.isOfficial,
        templateNumber: a.templateNumber,
        endAt: a.remainingSeconds === null ? null : Date.now() + a.remainingSeconds * 1000,
        questions: a.questions,
        answers: {}
      });
    } catch (err) {
      setError(err.message);
      load({ keepError: true });
    }
  }

  function selectAnswer(questionId, option) {
    setActiveQuiz((prev) => ({ ...prev, answers: { ...prev.answers, [questionId]: option } }));
  }

  // Also called automatically when the countdown reaches zero; reads the latest answers through quizRef.
  async function submitQuiz() {
    const quiz = quizRef.current;
    if (!quiz || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    const answers = Object.entries(quiz.answers).map(([questionId, selectedOption]) => ({
      questionId: Number(questionId),
      selectedOption
    }));
    setError('');
    try {
      const res = await api.submitHomeworkAnswers(quiz.homeworkId, quiz.attemptId, answers);
      setResult(res);
      setActiveQuiz(null);
    } catch (err) {
      // Server closed the attempt (time ran out before the answers arrived)
      setError(/Time is over/.test(err.message) ? t('expiredNoMark') : err.message);
      setActiveQuiz(null);
    } finally {
      setSubmitting(false);
      load({ keepError: true });
    }
  }

  // Countdown: derived from the end time the server gave us, so a throttled tab can't drift.
  useEffect(() => {
    if (!activeQuiz || activeQuiz.endAt === null) {
      setSecondsLeft(null);
      return undefined;
    }
    const tick = () => {
      const left = Math.max(0, Math.ceil((activeQuiz.endAt - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0) submitQuiz();
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [activeQuiz?.attemptId]);

  // --- Student quiz-taking view ---
  if (activeQuiz) {
    return (
      <div style={{ maxWidth: '560px' }}>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 500, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
          {t('homework')}
        </h2>
        <p style={{ margin: '0 0 8px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          {t('templateLabel')} {activeQuiz.templateNumber} · {activeQuiz.isOfficial ? t('firstAttemptCounts') : t('practiceMode')}
        </p>
        {secondsLeft !== null && (
          <p style={{ ...styles.timer, color: secondsLeft <= 60 ? 'var(--error)' : 'var(--text-primary)' }}>
            {t('timeLeft')}: {formatClock(secondsLeft)}
          </p>
        )}
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
        {error && <p style={{ color: 'var(--error)', fontSize: '0.812rem' }}>{error}</p>}
        <button onClick={submitQuiz} style={styles.primaryBtn} disabled={submitting}>
          {submitting ? t('submitting') : t('submit')}
        </button>
        <button onClick={() => setActiveQuiz(null)} style={styles.secondaryBtn}>{t('cancel')}</button>
        <button onClick={printQuiz} style={styles.secondaryBtn}>🖨 {t('printQuestions')}</button>
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
          {result.isOfficial ? t('firstAttemptScore') : t('yourScore')}: {formatMark(result.score, result.total)} ({result.score} / {result.total} {t('correctWord')})
          {!result.isOfficial && ` — ${t('practiceMode')}`}
        </p>
      )}

      {error && !showForm && <p style={{ color: 'var(--error)', fontSize: '0.812rem' }}>{error}</p>}

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
            <input
              type="number"
              min="1"
              max="600"
              step="1"
              placeholder={t('timeLimitMinutes')}
              value={form.durationMinutes}
              onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })}
              style={styles.input}
            />
          )}

          {homeworkType === 'mcq' && (
            <>
              <h4 style={{ fontSize: '0.9375rem', color: 'var(--text-primary)', margin: '1rem 0 0.25rem' }}>{t('templatesTitle')}</h4>
              <p style={{ margin: '0 0 8px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{t('templatesHelp')}</p>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
                {templates.map((_, ti) => (
                  <button
                    key={ti}
                    type="button"
                    onClick={() => setActiveTemplate(ti)}
                    style={ti === activeTemplate ? styles.primaryBtn : styles.secondaryBtn}
                  >
                    {t('templateLabel')} {ti + 1}
                  </button>
                ))}
                {templates.length < MAX_TEMPLATES && (
                  <button type="button" onClick={addTemplate} style={styles.secondaryBtn}>{t('addTemplate')}</button>
                )}
              </div>
              <h4 style={{ fontSize: '0.9375rem', color: 'var(--text-primary)', margin: '0.5rem 0' }}>
                {t('questions')} — {t('templateLabel')} {activeTemplate + 1}
              </h4>
              {templates[activeTemplate].map((q, idx) => (
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
                  {templates[activeTemplate].length > 1 && (
                    <button type="button" onClick={() => removeQuestion(idx)} style={styles.secondaryBtn}>
                      {t('removeQuestion')}
                    </button>
                  )}
                </div>
              ))}
              <button type="button" onClick={addQuestion} style={styles.secondaryBtn}>{t('addQuestion')}</button>
              {templates.length > 1 && (
                <button type="button" onClick={removeTemplate} style={styles.secondaryBtn}>{t('removeTemplate')}</button>
              )}
            </>
          )}

          {error && <p style={{ color: 'var(--error)', fontSize: '0.812rem' }}>{error}</p>}

          <button type="submit" style={styles.primaryBtn} disabled={creating}>
            {creating ? t('creating') : t('createHomework')}
          </button>
        </form>
      )}

      {loading && <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{t('loading')}</p>}
      {!loading && items.length === 0 && (
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{t('noHomeworkYet')}</p>
      )}

      {uploadMessage && <p style={{ color: 'var(--success)', fontSize: '0.812rem' }}>{uploadMessage}</p>}

      {viewingResultsFor && (
        <div style={styles.submissionsPanel}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ margin: 0, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>{t('results')}</h4>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={() => viewResults(viewingResultsFor)} style={styles.secondaryBtn}>{t('refresh')}</button>
              <button onClick={() => setViewingResultsFor(null)} style={styles.secondaryBtn}>{t('close')}</button>
            </div>
          </div>
          {results.length === 0 && (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.812rem' }}>{t('noStudentsEnrolled')}</p>
          )}
          {results.map((r) => (
            <div key={r.student_id} style={{ ...styles.row, display: 'block' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                <p style={{ margin: 0, fontSize: '0.812rem', color: 'var(--text-primary)' }}>{r.student_name}</p>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  {r.submitted_at ? (
                    <>
                      <span style={markStyle(r.score, r.total)}>{formatMark(r.score, r.total)}</span>{` (${r.score}/${r.total})`}
                      {` · ${t('templateLabel')} ${r.template_number}`}
                    </>
                  ) : r.started_at
                    ? `${t('inProgress')} · ${t('templateLabel')} ${r.template_number}`
                    : t('notStarted')}
                  {Number(r.practice_attempts) > 0 && ` · ${r.practice_attempts} ${t('practiceAttempts')}`}
                </p>
              </div>
              {r.submitted_at && r.attempt_id && <AttemptAnswers attemptId={r.attempt_id} whose="student" />}
            </div>
          ))}
        </div>
      )}

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
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-primary)' }}>{item.title}</p>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {item.subject_name} · {t('due')} {item.due_date.slice(0, 10)}
              {item.type === 'mcq' && ` · ${item.duration_minutes ? `${item.duration_minutes} ${t('minutesShort')}` : t('noTimeLimit')}`}
            </p>
            {user?.role === 'teacher' && item.type === 'mcq' && printMenuFor === item.id && (
              <div style={styles.printMenu}>
                <select value={printTemplate} onChange={(e) => setPrintTemplate(e.target.value)} style={{ ...styles.input, width: 'auto' }}>
                  <option value="all">{t('allTemplates')}</option>
                  {Array.from({ length: Number(item.template_count) }, (_, i) => (
                    <option key={i + 1} value={i + 1}>{t('templateLabel')} {i + 1}</option>
                  ))}
                </select>
                <button onClick={() => printHomework(item.id, 'blank')} style={styles.secondaryBtn}>{t('printWithout')}</button>
                <button onClick={() => printHomework(item.id, 'key')} style={styles.secondaryBtn}>{t('printWith')}</button>
              </div>
            )}
            {user?.role === 'student' && item.type === 'mcq' && item.my_submitted_at && (
              <>
                <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--text-primary)' }}>
                  {t('firstAttemptScore')}: <span style={markStyle(item.my_score, item.my_total)}>{formatMark(item.my_score, item.my_total)}</span> <span style={{ color: 'var(--text-secondary)' }}>({item.my_score} / {item.my_total} {t('correctWord')})</span>
                </p>
                {item.my_attempt_id && <AttemptAnswers attemptId={item.my_attempt_id} whose="mine" />}
              </>
            )}
          </div>
          {user?.role === 'student' && item.type === 'mcq' && !item.my_started_at && (
            <button onClick={() => startAttempt(item.id)} style={styles.secondaryBtn}>{t('start')}</button>
          )}
          {user?.role === 'student' && item.type === 'mcq' && item.my_started_at && !item.my_submitted_at && (
            <button onClick={() => startAttempt(item.id)} style={styles.secondaryBtn}>{t('resume')}</button>
          )}
          {user?.role === 'student' && item.type === 'mcq' && item.my_submitted_at && (
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <select
                value={practiceChoice[item.id] || 'random'}
                onChange={(e) => setPracticeChoice({ ...practiceChoice, [item.id]: e.target.value })}
                style={{ ...styles.input, width: 'auto' }}
              >
                <option value="random">{t('randomTemplate')}</option>
                {Array.from({ length: Number(item.template_count) }, (_, i) => (
                  <option key={i + 1} value={i + 1}>{t('templateLabel')} {i + 1}</option>
                ))}
              </select>
              <button
                onClick={() => startAttempt(item.id, practiceChoice[item.id] && practiceChoice[item.id] !== 'random' ? Number(practiceChoice[item.id]) : undefined)}
                style={styles.secondaryBtn}
              >
                {t('practice')}
              </button>
            </div>
          )}
          {user?.role === 'teacher' && item.type === 'mcq' && (
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={() => { setPrintTemplate('all'); setPrintMenuFor(printMenuFor === item.id ? null : item.id); }} style={styles.secondaryBtn}>🖨 {t('printHomework')}</button>
              <button onClick={() => viewResults(item.id)} style={styles.secondaryBtn}>{t('results')}</button>
            </div>
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
  printMenu: { display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center', marginTop: '6px' },
  resultBanner: { padding: '10px', borderRadius: '8px', background: 'var(--nav-active-bg)', color: 'var(--text-primary)', fontSize: '0.875rem', marginBottom: '1rem' },
  submissionsPanel: { padding: '1rem', border: '1px solid var(--border)', borderRadius: '10px', marginBottom: '1rem' },
  link: { fontSize: '0.812rem', color: 'var(--accent)' },
  timer: { margin: '0 0 12px', fontSize: '1.25rem', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }
};
