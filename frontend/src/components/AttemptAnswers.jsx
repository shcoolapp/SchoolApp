import { useState } from 'react';
import { api } from '../api/client';
import { useTranslation } from '../i18n/translations';
import { printAttempt } from '../lib/printSheet';

// "Show answers" toggle for a finished attempt: every question with the chosen and the correct answer.
// The answers are only fetched the first time it is opened. `whose` is 'mine' (student) or 'student' (teacher).
export default function AttemptAnswers({ attemptId, whose = 'mine' }) {
  const t = useTranslation();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !data) {
      try {
        setData(await api.getAttemptAnswers(attemptId));
      } catch (err) {
        setError(err.message);
      }
    }
  }

  // Prints the attempt with the correct answers (fetches it first if the list was never opened)
  async function print() {
    try {
      const d = data || await api.getAttemptAnswers(attemptId);
      if (!data) setData(d);
      printAttempt(d, whose, t);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div style={{ marginTop: '6px' }}>
      <button type="button" onClick={toggle} style={styles.toggle} aria-expanded={open}>
        {open ? '▾' : '▸'} {open ? t('hideAnswers') : t('showAnswers')}
      </button>
      <button type="button" onClick={print} style={{ ...styles.toggle, marginInlineStart: '14px' }}>
        🖨 {whose === 'mine' ? t('printWithMine') : t('printWithStudent')}
      </button>
      {!open && error && <p style={{ color: 'var(--error)', fontSize: '0.75rem', margin: '4px 0 0' }}>{error}</p>}
      {open && (
        <div style={styles.panel}>
          {error && <p style={{ color: 'var(--error)', fontSize: '0.75rem', margin: 0 }}>{error}</p>}
          {!data && !error && <p style={styles.muted}>{t('loading')}</p>}
          {data && data.questions.map((q, idx) => {
            const right = q.selected === q.correct;
            return (
              <div key={q.id} style={styles.question}>
                <p style={styles.qText}>
                  {idx + 1}. {q.text}{' '}
                  <span style={{ color: right ? 'var(--success)' : 'var(--mark-fail)', fontWeight: 600 }}>
                    {right ? '✓' : '✗'}
                  </span>
                </p>
                {['a', 'b', 'c', 'd'].map((opt) => {
                  const isCorrect = q.correct === opt;
                  const isChosen = q.selected === opt;
                  let tag = '';
                  if (isChosen && isCorrect) tag = `${whose === 'mine' ? t('yourAnswer') : t('studentAnswer')} · ${t('correctAnswer')}`;
                  else if (isChosen) tag = whose === 'mine' ? t('yourAnswer') : t('studentAnswer');
                  else if (isCorrect) tag = t('correctAnswer');
                  return (
                    <div
                      key={opt}
                      style={{
                        ...styles.option,
                        ...(isCorrect ? styles.correct : null),
                        ...(isChosen && !isCorrect ? styles.wrong : null)
                      }}
                    >
                      <span>{opt.toUpperCase()}. {q.options[opt]}</span>
                      {tag && <span style={styles.tag}>{tag}</span>}
                    </div>
                  );
                })}
                {!q.selected && <p style={styles.muted}>{t('noAnswerGiven')}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const styles = {
  toggle: { border: 'none', background: 'transparent', color: 'var(--cobalt)', fontSize: '0.75rem', cursor: 'pointer', padding: 0 },
  panel: { marginTop: '8px', padding: '10px 12px', border: '1px solid var(--border)', borderInlineStart: '4px solid var(--cobalt)', borderRadius: '8px', background: 'var(--surface)' },
  question: { padding: '8px 0', borderBottom: '1px solid var(--border)' },
  qText: { margin: '0 0 6px', fontSize: '0.812rem', color: 'var(--text-primary)' },
  option: { display: 'flex', justifyContent: 'space-between', gap: '8px', padding: '4px 8px', marginBottom: '3px', borderRadius: '6px', fontSize: '0.75rem', color: 'var(--text-primary)', border: '1px solid transparent' },
  correct: { background: 'var(--cobalt-soft)', border: '1px solid var(--success)' },
  wrong: { border: '1px solid var(--mark-fail)', color: 'var(--mark-fail)' },
  tag: { fontSize: '0.688rem', fontWeight: 600, whiteSpace: 'nowrap' },
  muted: { margin: '4px 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }
};
